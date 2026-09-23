/**
 * Explicit Meal runtime context identity.
 * Selected from the approved experiment pack, not from a lemma guess.
 */

import { experimentalMealContextLabPack } from "../content/experimental-meal-runtime-pack";
import { MEAL_SCENE_CONTENT_PACK } from "../content/packs/meal/meal-scene-content";
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID } from "../content/packs/meal/meal-scene-expansion-batch-02";
import {
  MEAL_SCENE_EXPANSION_BATCH_03_PACK,
  MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
} from "../content/packs/meal/meal-scene-expansion-batch-03";
import type { ContextualSceneContentPack } from "../content/types";
import type { ContextFrame, SemanticSkeleton } from "../domain/types";
import { MEAL_FRAMES } from "../fixtures/meal/contexts";
import { MEAL_BATCH_02_FRAMES } from "../fixtures/meal/meal-batch-02-contexts";
import { MEAL_BATCH_03_FRAMES } from "../fixtures/meal/meal-batch-03-contexts";
import { mealBatch02Skeleton } from "../fixtures/meal/meal-batch-02-skeleton";
import { mealBatch03Skeleton } from "../fixtures/meal/meal-batch-03-skeleton";
import { mealSkeleton } from "../fixtures/meal/skeleton";

export type MealRuntimeContextId = "MEAL_BASE" | "MEAL_BATCH_02" | "MEAL_BATCH_03";

const PACK_RUNTIME_CONTEXT: Record<string, MealRuntimeContextId> = {
  [MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID]: "MEAL_BATCH_02",
  [MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID]: "MEAL_BATCH_03",
};

export function mealRuntimeContextIdForPack(packId: string): MealRuntimeContextId {
  return PACK_RUNTIME_CONTEXT[packId] ?? "MEAL_BASE";
}

export function experimentalMealRuntimeContextId(): MealRuntimeContextId {
  return mealRuntimeContextIdForPack(experimentalMealContextLabPack().id);
}

export function framesForMealRuntime(
  runtimeContextId: MealRuntimeContextId,
): readonly ContextFrame[] {
  if (runtimeContextId === "MEAL_BATCH_03") {
    return MEAL_BATCH_03_FRAMES;
  }
  return runtimeContextId === "MEAL_BATCH_02" ? MEAL_BATCH_02_FRAMES : MEAL_FRAMES;
}

export function skeletonForMealRuntime(
  runtimeContextId: MealRuntimeContextId,
): SemanticSkeleton {
  if (runtimeContextId === "MEAL_BATCH_03") {
    return mealBatch03Skeleton;
  }
  return runtimeContextId === "MEAL_BATCH_02" ? mealBatch02Skeleton : mealSkeleton;
}

export function frameForMealRuntime(
  contextFrameId: string,
  runtimeContextId: MealRuntimeContextId = "MEAL_BASE",
): ContextFrame | undefined {
  return framesForMealRuntime(runtimeContextId).find((frame) => frame.id === contextFrameId);
}

export function resolveMealRuntimeContext(runtimeContextId: MealRuntimeContextId): {
  id: MealRuntimeContextId;
  frames: readonly ContextFrame[];
  skeleton: SemanticSkeleton;
} {
  return {
    id: runtimeContextId,
    frames: framesForMealRuntime(runtimeContextId),
    skeleton: skeletonForMealRuntime(runtimeContextId),
  };
}

export function packForMealRuntime(
  runtimeContextId: MealRuntimeContextId,
): ContextualSceneContentPack {
  if (runtimeContextId === "MEAL_BATCH_03") {
    return MEAL_SCENE_EXPANSION_BATCH_03_PACK;
  }
  if (runtimeContextId === "MEAL_BATCH_02") {
    return experimentalMealContextLabPack();
  }
  return MEAL_SCENE_CONTENT_PACK;
}
