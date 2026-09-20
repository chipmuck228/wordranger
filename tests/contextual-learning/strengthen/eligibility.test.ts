import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { isSpoonActiveRecallStrengthenEligible } from "@/contextual-learning/candidate-v0/strengthen/eligibility";
import type { ProbeObservationRef } from "@/contextual-learning/candidate-v0/probe/types";

const spoon = {
  lexemeId: BUNDLED_SPOON_LEXEME_ID,
  senseId: MEAL_SENSE.spoon.senseId,
};

function observation(
  skill: ProbeObservationRef["skill"],
  outcome: EvidenceOutcome,
): ProbeObservationRef {
  return {
    target: spoon,
    skill,
    taskId: `task-${skill}`,
    evidenceId: `ev-${skill}`,
    outcome,
  };
}

const weakHeld = [
  observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
  observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
] as const;

describe("spoon active-recall STRENGTHEN eligibility", () => {
  it("accepts spoon STRENGTHEN with weak recall and held recognition", () => {
    expect(
      isSpoonActiveRecallStrengthenEligible({
        targetLexemeId: BUNDLED_SPOON_LEXEME_ID,
        spoonLexemeId: BUNDLED_SPOON_LEXEME_ID,
        disposition: "STRENGTHEN",
        observations: weakHeld,
      }),
    ).toBe(true);
  });

  it("rejects BUILD, READY, UNRESOLVED, and non-spoon STRENGTHEN", () => {
    expect(
      isSpoonActiveRecallStrengthenEligible({
        targetLexemeId: BUNDLED_SPOON_LEXEME_ID,
        spoonLexemeId: BUNDLED_SPOON_LEXEME_ID,
        disposition: "BUILD",
        observations: weakHeld,
      }),
    ).toBe(false);
    expect(
      isSpoonActiveRecallStrengthenEligible({
        targetLexemeId: BUNDLED_SPOON_LEXEME_ID,
        spoonLexemeId: BUNDLED_SPOON_LEXEME_ID,
        disposition: "READY",
        observations: [
          observation("ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT),
        ],
      }),
    ).toBe(false);
    expect(
      isSpoonActiveRecallStrengthenEligible({
        targetLexemeId: BUNDLED_SPOON_LEXEME_ID,
        spoonLexemeId: BUNDLED_SPOON_LEXEME_ID,
        disposition: "UNRESOLVED",
        observations: [observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT)],
      }),
    ).toBe(false);
    expect(
      isSpoonActiveRecallStrengthenEligible({
        targetLexemeId: "00000000-0000-4000-8000-00000000fork",
        spoonLexemeId: BUNDLED_SPOON_LEXEME_ID,
        disposition: "STRENGTHEN",
        observations: weakHeld,
      }),
    ).toBe(false);
  });

  it("rejects missing observations or identity mismatch", () => {
    expect(
      isSpoonActiveRecallStrengthenEligible({
        targetLexemeId: BUNDLED_SPOON_LEXEME_ID,
        spoonLexemeId: BUNDLED_SPOON_LEXEME_ID,
        disposition: "STRENGTHEN",
        observations: [observation("ACTIVE_RECALL", EvidenceOutcome.INCORRECT)],
      }),
    ).toBe(false);
    expect(
      isSpoonActiveRecallStrengthenEligible({
        targetLexemeId: BUNDLED_SPOON_LEXEME_ID,
        spoonLexemeId: BUNDLED_SPOON_LEXEME_ID,
        disposition: "STRENGTHEN",
        observations: [
          observation("ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT),
          observation("MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        ],
      }),
    ).toBe(false);
  });
});
