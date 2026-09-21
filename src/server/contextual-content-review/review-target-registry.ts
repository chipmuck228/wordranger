/**
 * Explicit review-target manifest. Candidate packs are not auto-listed.
 */

import { MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01";
import type { LexemeSenseRef } from "@/contextual-learning/candidate-v0/domain/types";

export interface ContentReviewTargetSpec {
  reviewKey: string;
  packId: string;
  routePackId: string;
  targetSlug: string;
  title: string;
  target: LexemeSenseRef;
}

export const CONTENT_REVIEW_TARGETS: readonly ContentReviewTargetSpec[] = [
  {
    reviewKey: "meal-expansion-batch-01-cup",
    packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
    routePackId: "meal-expansion-batch-01",
    targetSlug: "cup",
    title: "Meal Expansion Batch 01",
    target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
  },
];

export function findReviewTarget(input: {
  routePackId: string;
  targetSlug: string;
}): ContentReviewTargetSpec | null {
  const matches = CONTENT_REVIEW_TARGETS.filter(
    (item) => item.routePackId === input.routePackId && item.targetSlug === input.targetSlug,
  );
  return matches.length === 1 ? matches[0]! : null;
}

export function reviewTargetByKey(reviewKey: string): ContentReviewTargetSpec | null {
  const matches = CONTENT_REVIEW_TARGETS.filter((item) => item.reviewKey === reviewKey);
  return matches.length === 1 ? matches[0]! : null;
}

export function reviewHref(spec: ContentReviewTargetSpec): string {
  return `/debug/contextual-content-review/${spec.routePackId}/${spec.targetSlug}`;
}
