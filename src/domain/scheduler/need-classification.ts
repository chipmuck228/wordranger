import type { LearningNeed, LearningNeedReason } from "@/domain/learning/learning-need";
import { REVIEW_REASONS } from "./scheduler-policy";

export function learningNeedReasons(need: LearningNeed): LearningNeedReason[] {
  return [need.reason, ...(need.supportingReasons ?? [])];
}

export function learningNeedHasReason(
  need: LearningNeed,
  reason: LearningNeedReason,
): boolean {
  return learningNeedReasons(need).includes(reason);
}

export function isNewIntroductionNeed(need: LearningNeed): boolean {
  return learningNeedHasReason(need, "NEW_WORD");
}

export function isReviewNeed(need: LearningNeed): boolean {
  return REVIEW_REASONS.some((reason) => learningNeedHasReason(need, reason));
}
