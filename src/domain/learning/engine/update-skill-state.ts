import type { LearningEvidence } from "../evidence.types";
import type { LearningPolicy } from "../policies/learning-policy";
import type { SkillState } from "../student-lexeme-model";
import { clamp01 } from "./math";
import {
  isAssistedCorrect,
  isFailure,
  isIndependentSuccess,
  isSkipped,
  isSuccess,
} from "./evidence-helpers";
import { calendarDay, distinctCount } from "./time";

export function calculateEvidenceTargetScore(
  evidence: LearningEvidence,
  policy: LearningPolicy,
): number {
  const outcomeTarget =
    policy.skillUpdate.outcomeTargetScores[evidence.outcome];
  const modeWeight = policy.skillUpdate.answerModeWeights[evidence.answerMode];
  const floor = policy.skillUpdate.answerModeNeutralFloor;
  const modeFactor = floor + (1 - floor) * modeWeight;
  const difficultyFactor =
    1 + (evidence.difficulty - 0.5) * policy.skillUpdate.difficultyInfluence;
  return clamp01(outcomeTarget * modeFactor * difficultyFactor);
}

export function calculateSkillConfidence(
  skillHistory: readonly LearningEvidence[],
  policy: LearningPolicy,
): number {
  const countable = skillHistory.filter((item) => !isSkipped(item));
  const attempts = countable.length;
  const independent = skillHistory.filter(isIndependentSuccess).length;
  const sessions = distinctCount(skillHistory.map((item) => item.sessionId));
  const days = distinctCount(
    skillHistory.map((item) => calendarDay(item.occurredAt)),
  );
  const weights = policy.confidence.skillWeights;

  return clamp01(
    weights.attempts *
      Math.min(1, attempts / policy.confidence.skillAttemptDenom) +
      weights.independent *
        Math.min(1, independent / policy.confidence.skillIndependentDenom) +
      weights.sessions *
        Math.min(1, sessions / policy.confidence.skillSessionDenom) +
      weights.days * Math.min(1, days / policy.confidence.skillDayDenom),
  );
}

export interface UpdateSkillStateInput {
  skillState: SkillState;
  evidence: LearningEvidence;
  skillHistory: readonly LearningEvidence[];
  policy: LearningPolicy;
}

export function updateSkillState(input: UpdateSkillStateInput): SkillState {
  const { skillState, evidence, skillHistory, policy } = input;
  const alpha = isSkipped(evidence)
    ? policy.skillUpdate.skippedEwmaAlpha
    : policy.skillUpdate.ewmaAlpha;
  const target = calculateEvidenceTargetScore(evidence, policy);
  const score = clamp01(skillState.score * (1 - alpha) + target * alpha);

  const recentPerformance = [
    {
      evidenceId: evidence.id,
      occurredAt: evidence.occurredAt,
      outcome: evidence.outcome,
      responseTimeMs: evidence.responseTimeMs,
      hintCount: evidence.hintCount,
      difficulty: evidence.difficulty,
    },
    ...skillState.recentPerformance,
  ].slice(0, policy.skillUpdate.recentPerformanceLimit);

  const independent = isIndependentSuccess(evidence);
  const failed = isFailure(evidence);

  return {
    ...skillState,
    score,
    confidence: calculateSkillConfidence(skillHistory, policy),
    totalAttempts: isSkipped(evidence)
      ? skillState.totalAttempts
      : skillState.totalAttempts + 1,
    correctAttempts: isSuccess(evidence)
      ? skillState.correctAttempts + 1
      : skillState.correctAttempts,
    incorrectAttempts: failed
      ? skillState.incorrectAttempts + 1
      : skillState.incorrectAttempts,
    assistedAttempts: isAssistedCorrect(evidence)
      ? skillState.assistedAttempts + 1
      : skillState.assistedAttempts,
    lastPracticedAt: evidence.occurredAt,
    lastIndependentSuccessAt: independent
      ? evidence.occurredAt
      : skillState.lastIndependentSuccessAt,
    consecutiveIndependentSuccesses: independent
      ? skillState.consecutiveIndependentSuccesses + 1
      : isSkipped(evidence)
        ? skillState.consecutiveIndependentSuccesses
        : 0,
    recentPerformance,
  };
}
