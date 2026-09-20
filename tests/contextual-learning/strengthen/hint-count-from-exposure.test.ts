import { describe, expect, it } from "vitest";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { deriveFrozenHintCountFromSupportExposure } from "@/contextual-learning/candidate-v0/strengthen/derive-frozen-hint-count";
import { spellingCueFromDisplayForm } from "@/contextual-learning/candidate-v0/strengthen/spelling-cue";
import type { ContextualSupportExposure } from "@/contextual-learning/candidate-v0/strengthen/types";

const spoon = {
  lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.spoon),
  senseId: MEAL_SENSE.spoon.senseId,
};
const soup = {
  lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.soup),
  senseId: MEAL_SENSE.soup.senseId,
};

function exposure(
  kind: ContextualSupportExposure["kind"],
  extras: Partial<ContextualSupportExposure> = {},
): ContextualSupportExposure {
  return {
    supportId: `support-${kind}`,
    kind,
    target: spoon,
    shownAt: "2026-09-20T00:00:00.000Z",
    sourceStepId: "home-strengthen-spoon-reconnect",
    planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
    ...extras,
  };
}

const STEP_IDS = [
  "home-strengthen-spoon-reconnect",
  "home-strengthen-spoon-fade",
  "home-strengthen-spoon-recall",
] as const;

describe("deriveFrozenHintCountFromSupportExposure", () => {
  it("maps lexical form or spelling cue exposure to hintCount 1", () => {
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
        verificationStepId: "home-strengthen-spoon-recall",
        stepIds: STEP_IDS,
        exposures: [exposure("LEXICAL_FORM")],
      }),
    ).toEqual({ ok: true, hintCount: 1 });
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
        verificationStepId: "home-strengthen-spoon-recall",
        stepIds: STEP_IDS,
        exposures: [
          exposure("SPELLING_CUE", { sourceStepId: "home-strengthen-spoon-fade" }),
        ],
      }),
    ).toEqual({ ok: true, hintCount: 1 });
  });

  it("does not count another target or another plan", () => {
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
        verificationStepId: "home-strengthen-spoon-recall",
        stepIds: STEP_IDS,
        exposures: [exposure("LEXICAL_FORM", { target: soup })],
      }).ok,
    ).toBe(false);
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
        verificationStepId: "home-strengthen-spoon-recall",
        stepIds: STEP_IDS,
        exposures: [exposure("LEXICAL_FORM", { planId: "other-plan" })],
      }).ok,
    ).toBe(false);
  });

  it("fails closed on missing, future, or malformed exposure", () => {
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
        verificationStepId: "home-strengthen-spoon-recall",
        stepIds: STEP_IDS,
        exposures: [],
      }).ok,
    ).toBe(false);
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
        verificationStepId: "home-strengthen-spoon-recall",
        stepIds: STEP_IDS,
        exposures: [exposure("MEANING_GLOSS")],
      }).ok,
    ).toBe(false);
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
        verificationStepId: "home-strengthen-spoon-recall",
        stepIds: STEP_IDS,
        exposures: [
          exposure("LEXICAL_FORM", { sourceStepId: "home-strengthen-spoon-recall" }),
        ],
      }).ok,
    ).toBe(false);
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        planId: "meal-strengthen-recall-home-breakfast-v0-spoon",
        verificationStepId: "home-strengthen-spoon-recall",
        stepIds: STEP_IDS,
        exposures: [exposure("LEXICAL_FORM", { shownAt: "" })],
      }).ok,
    ).toBe(false);
  });

  it("builds a deterministic cue from the verified display form", () => {
    expect(spellingCueFromDisplayForm("spoon")).toBe("s _ _ _ _");
    expect(spellingCueFromDisplayForm("bowl")).toBe("b _ _ _");
    expect(spellingCueFromDisplayForm("")).toBeNull();
  });
});
