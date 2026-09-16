import { describe, expect, it } from "vitest";
import {
  AnswerMode,
  EvidenceOutcome,
} from "@/domain/learning/evidence.types";
import { clamp01 } from "@/domain/learning/engine/math";
import {
  calculateEvidenceTargetScore,
  updateSkillState,
} from "@/domain/learning/engine/update-skill-state";
import { DEFAULT_LEARNING_POLICY } from "@/domain/learning/policies/default-learning-policy";
import { createInitialSkillState } from "@/domain/learning/student-lexeme-model";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { makeEvidence } from "./helpers";

describe("updateSkillState", () => {
  it("uses a lower target for ASSISTED_CORRECT than INDEPENDENT_CORRECT", () => {
    const independent = makeEvidence("a", "s", "2026-03-01T00:00:00.000Z", {
      outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
      answerMode: AnswerMode.TYPING,
    });
    const assisted = makeEvidence("b", "s", "2026-03-01T00:00:00.000Z", {
      outcome: EvidenceOutcome.ASSISTED_CORRECT,
      answerMode: AnswerMode.TYPING,
      hintCount: 1,
    });
    expect(
      calculateEvidenceTargetScore(independent, DEFAULT_LEARNING_POLICY),
    ).toBeGreaterThan(
      calculateEvidenceTargetScore(assisted, DEFAULT_LEARNING_POLICY),
    );
  });

  it("does not punish SKIPPED like an incorrect answer", () => {
    const skipped = makeEvidence("s", "s1", "2026-03-01T00:00:00.000Z", {
      outcome: EvidenceOutcome.SKIPPED,
    });
    const incorrect = makeEvidence("i", "s1", "2026-03-01T00:00:00.000Z", {
      outcome: EvidenceOutcome.INCORRECT,
    });
    const skippedState = updateSkillState({
      skillState: createInitialSkillState(VocabularySkill.MEANING_RECOGNITION),
      evidence: skipped,
      skillHistory: [skipped],
      policy: DEFAULT_LEARNING_POLICY,
    });
    const incorrectState = updateSkillState({
      skillState: { ...createInitialSkillState(VocabularySkill.MEANING_RECOGNITION), score: 0.7 },
      evidence: incorrect,
      skillHistory: [incorrect],
      policy: DEFAULT_LEARNING_POLICY,
    });
    expect(skippedState.incorrectAttempts).toBe(0);
    expect(incorrectState.score).toBeLessThan(0.7);
    expect(skippedState.score).toBeGreaterThan(0);
    expect(skippedState.score).toBeLessThan(0.2);
  });

  it("keeps recentPerformance within the policy window", () => {
    let state = createInitialSkillState(VocabularySkill.MEANING_RECOGNITION);
    const history = [];
    for (let index = 0; index < 15; index += 1) {
      const evidence = makeEvidence(
        `p-${index}`,
        "s",
        `2026-03-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      );
      history.push(evidence);
      state = updateSkillState({
        skillState: state,
        evidence,
        skillHistory: history,
        policy: DEFAULT_LEARNING_POLICY,
      });
    }
    expect(state.recentPerformance).toHaveLength(
      DEFAULT_LEARNING_POLICY.skillUpdate.recentPerformanceLimit,
    );
  });
});

describe("clamp01", () => {
  it("clamps below 0 and above 1", () => {
    expect(clamp01(-4)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });
});
