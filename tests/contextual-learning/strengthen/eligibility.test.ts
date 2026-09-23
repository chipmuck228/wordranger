import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  isActiveRecallStrengthenEligible,
  isSpoonActiveRecallStrengthenEligible,
} from "@/contextual-learning/candidate-v0/strengthen/eligibility";
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

function weakHeld(target: LexemeSenseRef): ProbeObservationRef[] {
  return [
    observation(target, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
    observation(target, "MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
  ];
}

describe("active-recall STRENGTHEN eligibility", () => {
  it.each(Object.entries(TARGETS))(
    "accepts %s with weak recall and held recognition",
    (_name, target) => {
      expect(
        isActiveRecallStrengthenEligible({
          target,
          disposition: "STRENGTHEN",
          observations: weakHeld(target),
        }),
      ).toBe(true);
    },
  );

  it("rejects observation target identity mismatch", () => {
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.spoon,
        disposition: "STRENGTHEN",
        observations: [
          observation(TARGETS.spoon, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
          observation(TARGETS.fork, "MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        ],
      }),
    ).toBe(false);
  });

  it("rejects sense mismatch on the same lexeme", () => {
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.spoon,
        disposition: "STRENGTHEN",
        observations: [
          observation(TARGETS.spoon, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
          observation(
            { lexemeId: TARGETS.spoon.lexemeId, senseId: "other-sense" },
            "MEANING_RECOGNITION",
            EvidenceOutcome.INDEPENDENT_CORRECT,
          ),
        ],
      }),
    ).toBe(false);
  });

  it("rejects duplicate recall or recognition", () => {
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.bowl,
        disposition: "STRENGTHEN",
        observations: [
          observation(TARGETS.bowl, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT, "recall-1"),
          observation(TARGETS.bowl, "ACTIVE_RECALL", EvidenceOutcome.SKIPPED, "recall-2"),
          observation(TARGETS.bowl, "MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        ],
      }),
    ).toBe(false);
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.bowl,
        disposition: "STRENGTHEN",
        observations: [
          observation(TARGETS.bowl, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
          observation(
            TARGETS.bowl,
            "MEANING_RECOGNITION",
            EvidenceOutcome.INDEPENDENT_CORRECT,
            "rec-1",
          ),
          observation(
            TARGETS.bowl,
            "MEANING_RECOGNITION",
            EvidenceOutcome.ASSISTED_CORRECT,
            "rec-2",
          ),
        ],
      }),
    ).toBe(false);
  });

  it("rejects conflicting outcomes, empty task IDs, and shared task IDs", () => {
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.soup,
        disposition: "STRENGTHEN",
        observations: [
          observation(TARGETS.soup, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT, "same"),
          observation(TARGETS.soup, "MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT, "same"),
        ],
      }),
    ).toBe(false);
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.soup,
        disposition: "STRENGTHEN",
        observations: [
          { ...observation(TARGETS.soup, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT), taskId: "" },
          observation(TARGETS.soup, "MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        ],
      }),
    ).toBe(false);
  });

  it("rejects failed recognition, independent recall, BUILD/READY, and unknown outcomes", () => {
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.fork,
        disposition: "STRENGTHEN",
        observations: [
          observation(TARGETS.fork, "ACTIVE_RECALL", EvidenceOutcome.INCORRECT),
          observation(TARGETS.fork, "MEANING_RECOGNITION", EvidenceOutcome.INCORRECT),
        ],
      }),
    ).toBe(false);
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.fork,
        disposition: "STRENGTHEN",
        observations: [
          observation(TARGETS.fork, "ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT),
          observation(TARGETS.fork, "MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        ],
      }),
    ).toBe(false);
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.fork,
        disposition: "BUILD",
        observations: weakHeld(TARGETS.fork),
      }),
    ).toBe(false);
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.fork,
        disposition: "READY",
        observations: [
          observation(TARGETS.fork, "ACTIVE_RECALL", EvidenceOutcome.INDEPENDENT_CORRECT),
        ],
      }),
    ).toBe(false);
    expect(
      isActiveRecallStrengthenEligible({
        target: TARGETS.fork,
        disposition: "STRENGTHEN",
        observations: [
          observation(TARGETS.fork, "ACTIVE_RECALL", "FUTURE_OUTCOME" as EvidenceOutcome),
          observation(TARGETS.fork, "MEANING_RECOGNITION", EvidenceOutcome.INDEPENDENT_CORRECT),
        ],
      }),
    ).toBe(false);
  });

  it("keeps the spoon helper as a narrow wrapper", () => {
    expect(
      isSpoonActiveRecallStrengthenEligible({
        target: TARGETS.spoon,
        disposition: "STRENGTHEN",
        observations: weakHeld(TARGETS.spoon),
      }),
    ).toBe(true);
    expect(
      isSpoonActiveRecallStrengthenEligible({
        target: TARGETS.fork,
        disposition: "STRENGTHEN",
        observations: weakHeld(TARGETS.fork),
      }),
    ).toBe(false);
  });
});
