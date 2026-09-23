import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { isActiveRecallBuildEligible } from "@/contextual-learning/candidate-v0/build/eligibility";
import type { LexemeSenseRef } from "@/contextual-learning/candidate-v0/domain/types";
import type { ProbeObservationRef } from "@/contextual-learning/candidate-v0/probe/types";

const TARGETS = {
  soup: {
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.soup),
    senseId: MEAL_SENSE.soup.senseId,
  },
  bowl: {
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.bowl),
    senseId: MEAL_SENSE.bowl.senseId,
  },
  spoon: {
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.spoon),
    senseId: MEAL_SENSE.spoon.senseId,
  },
  fork: {
    lexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.fork),
    senseId: MEAL_SENSE.fork.senseId,
  },
} as const;

function observation(
  target: LexemeSenseRef,
  skill: ProbeObservationRef["skill"],
  outcome: EvidenceOutcome,
  taskId = `task-${skill}`,
): ProbeObservationRef {
  return {
    target,
    skill,
    taskId,
    evidenceId: `ev-${skill}`,
    outcome,
  };
}

function failedBoth(target: LexemeSenseRef): ProbeObservationRef[] {
  return [
    observation(target, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
    observation(target, "MEANING_RECOGNITION", EvidenceOutcome.INCORRECT),
  ];
}

describe("active-recall BUILD eligibility", () => {
  it.each(Object.entries(TARGETS))(
    "accepts %s with weak recall and failed recognition",
    (_name, target) => {
      expect(
        isActiveRecallBuildEligible({
          target,
          disposition: "BUILD",
          observations: failedBoth(target),
        }),
      ).toBe(true);
    },
  );

  it("rejects held recognition that would be STRENGTHEN", () => {
    expect(
      isActiveRecallBuildEligible({
        target: TARGETS.spoon,
        disposition: "BUILD",
        observations: [
          observation(TARGETS.spoon, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
          observation(
            TARGETS.spoon,
            "MEANING_RECOGNITION",
            EvidenceOutcome.INDEPENDENT_CORRECT,
          ),
        ],
      }),
    ).toBe(false);
  });

  it("rejects independent recall", () => {
    expect(
      isActiveRecallBuildEligible({
        target: TARGETS.soup,
        disposition: "BUILD",
        observations: [
          observation(
            TARGETS.soup,
            "ACTIVE_RECALL",
            EvidenceOutcome.INDEPENDENT_CORRECT,
          ),
        ],
      }),
    ).toBe(false);
  });

  it("rejects wrong-target observations", () => {
    expect(
      isActiveRecallBuildEligible({
        target: TARGETS.bowl,
        disposition: "BUILD",
        observations: [
          observation(TARGETS.bowl, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
          observation(TARGETS.fork, "MEANING_RECOGNITION", EvidenceOutcome.INCORRECT),
        ],
      }),
    ).toBe(false);
  });

  it("rejects reused task IDs", () => {
    expect(
      isActiveRecallBuildEligible({
        target: TARGETS.fork,
        disposition: "BUILD",
        observations: [
          observation(TARGETS.fork, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT, "same"),
          observation(
            TARGETS.fork,
            "MEANING_RECOGNITION",
            EvidenceOutcome.INCORRECT,
            "same",
          ),
        ],
      }),
    ).toBe(false);
  });

  it("rejects duplicate observations", () => {
    expect(
      isActiveRecallBuildEligible({
        target: TARGETS.soup,
        disposition: "BUILD",
        observations: [
          ...failedBoth(TARGETS.soup),
          observation(TARGETS.soup, "ACTIVE_RECALL", EvidenceOutcome.SKIPPED, "extra"),
        ],
      }),
    ).toBe(false);
  });

  it("rejects unknown outcomes and non-BUILD dispositions", () => {
    expect(
      isActiveRecallBuildEligible({
        target: TARGETS.spoon,
        disposition: "STRENGTHEN",
        observations: failedBoth(TARGETS.spoon),
      }),
    ).toBe(false);
    expect(
      isActiveRecallBuildEligible({
        target: TARGETS.spoon,
        disposition: "BUILD",
        observations: [
          observation(TARGETS.spoon, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
          {
            ...observation(
              TARGETS.spoon,
              "MEANING_RECOGNITION",
              EvidenceOutcome.INCORRECT,
            ),
            outcome: "FUTURE_OUTCOME" as EvidenceOutcome,
          },
        ],
      }),
    ).toBe(false);
  });
});
