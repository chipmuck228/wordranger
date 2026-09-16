import { MasteryStage } from "../mastery-stage";
import type { LearningPolicy } from "../policies/learning-policy";
import { RetentionState } from "../retention-state";
import { addDays } from "./time";

export interface CalculateNextReviewInput {
  stage: MasteryStage;
  retentionState: RetentionState;
  now: string;
  policy: LearningPolicy;
}

export interface NextReviewResult {
  nextReviewAt: string;
  reviewIntervalDays: number;
}

export function calculateNextReview(
  input: CalculateNextReviewInput,
): NextReviewResult {
  const { stage, retentionState, now, policy } = input;
  const baseDays = policy.review.intervalDaysByStage[stage];
  let multiplier = 1;
  if (retentionState === RetentionState.FADING) {
    multiplier = policy.review.fadingMultiplier;
  } else if (retentionState === RetentionState.RECOVERING) {
    multiplier = policy.review.recoveringMultiplier;
  }

  const reviewIntervalDays = Math.max(0.25, baseDays * multiplier);
  return {
    reviewIntervalDays,
    nextReviewAt: addDays(now, reviewIntervalDays),
  };
}
