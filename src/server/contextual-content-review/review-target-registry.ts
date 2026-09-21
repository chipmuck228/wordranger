/**
 * Explicit review-target manifest. Candidate packs are not auto-listed.
 * Output directories are derived from registered review keys only.
 */

import { MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01";
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-02";
import { MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-02";
import type { SceneContentRegistryStatus } from "@/contextual-learning/candidate-v0/content/types";
import type { LexemeSenseRef } from "@/contextual-learning/candidate-v0/domain/types";

export const REVIEW_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ContentReviewTargetSpec {
  reviewKey: string;
  packId: string;
  routePackId: string;
  targetSlug: string;
  title: string;
  target: LexemeSenseRef;
  expectedRegistryStatus: SceneContentRegistryStatus;
  artifactDirectory: string;
  sourceRefs: readonly string[];
  frameLabels: readonly string[];
}

function artifactDirectoryFor(reviewKey: string): string {
  return `docs/contextual-content-reviews/${reviewKey}`;
}

export const CONTENT_REVIEW_TARGETS: readonly ContentReviewTargetSpec[] = [
  {
    reviewKey: "meal-expansion-batch-01-cup",
    packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
    routePackId: "meal-expansion-batch-01",
    targetSlug: "cup",
    title: "Meal Expansion Batch 01",
    target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
    expectedRegistryStatus: "APPROVED_FOR_EXPERIMENT",
    artifactDirectory: artifactDirectoryFor("meal-expansion-batch-01-cup"),
    sourceRefs: MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.sourceRefs,
    frameLabels: ["Home Breakfast", "Restaurant Meal"],
  },
  {
    reviewKey: "meal-expansion-batch-02-plate",
    packId: MEAL_SCENE_EXPANSION_BATCH_02_PACK.id,
    routePackId: "meal-expansion-batch-02",
    targetSlug: "plate",
    title: "Meal Expansion Batch 02",
    target: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
    expectedRegistryStatus: "CANDIDATE",
    artifactDirectory: artifactDirectoryFor("meal-expansion-batch-02-plate"),
    sourceRefs: MEAL_SCENE_EXPANSION_BATCH_02_PACK.provenance.sourceRefs,
    frameLabels: ["Home Breakfast", "Restaurant Meal"],
  },
];

export function findReviewTarget(input: {
  routePackId: string;
  targetSlug: string;
}): ContentReviewTargetSpec | null {
  if (!REVIEW_KEY_PATTERN.test(input.routePackId) || !REVIEW_KEY_PATTERN.test(input.targetSlug)) {
    return null;
  }
  const matches = CONTENT_REVIEW_TARGETS.filter(
    (item) => item.routePackId === input.routePackId && item.targetSlug === input.targetSlug,
  );
  return matches.length === 1 ? matches[0]! : null;
}

export function reviewTargetByKey(reviewKey: string): ContentReviewTargetSpec | null {
  if (!REVIEW_KEY_PATTERN.test(reviewKey)) {
    return null;
  }
  const matches = CONTENT_REVIEW_TARGETS.filter((item) => item.reviewKey === reviewKey);
  return matches.length === 1 ? matches[0]! : null;
}

export function reviewHref(spec: ContentReviewTargetSpec): string {
  return `/debug/contextual-content-review/${spec.routePackId}/${spec.targetSlug}`;
}
