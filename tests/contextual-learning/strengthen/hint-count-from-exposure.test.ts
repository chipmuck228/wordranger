import { describe, expect, it } from "vitest";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { deriveFrozenHintCountFromSupportExposure } from "@/contextual-learning/candidate-v0/strengthen/derive-frozen-hint-count";
import { spellingCueFromDisplayForm } from "@/contextual-learning/candidate-v0/strengthen/spelling-cue";
import type { ContextualSupportExposure } from "@/contextual-learning/candidate-v0/strengthen/types";

const spoon = {
  lexemeId: BUNDLED_SPOON_LEXEME_ID,
  senseId: MEAL_SENSE.spoon.senseId,
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
    sourceStepId: "home-strengthen-reconnect",
    ...extras,
  };
}

describe("deriveFrozenHintCountFromSupportExposure", () => {
  it("maps lexical form or spelling cue exposure to hintCount > 0", () => {
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        exposures: [exposure("LEXICAL_FORM")],
      }),
    ).toBe(1);
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        exposures: [exposure("SPELLING_CUE")],
      }),
    ).toBe(1);
  });

  it("returns 0 without form support or when the target/run does not match", () => {
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        exposures: [],
      }),
    ).toBe(0);
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        exposures: [exposure("MEANING_GLOSS")],
      }),
    ).toBe(0);
    expect(
      deriveFrozenHintCountFromSupportExposure({
        target: spoon,
        exposures: [
          exposure("LEXICAL_FORM", {
            target: { lexemeId: "other-lexeme", senseId: spoon.senseId },
          }),
        ],
      }),
    ).toBe(0);
  });

  it("builds a deterministic cue from the verified display form", () => {
    expect(spellingCueFromDisplayForm("spoon")).toBe("s _ _ _ _");
    expect(spellingCueFromDisplayForm("")).toBeNull();
  });
});
