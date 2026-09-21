/**
 * Explicit Meal runtime context identity.
 * Selected from the approved experiment pack, not from a lemma guess.
 */

import { experimentalMealContextLabPack } from "../content/experimental-meal-runtime-pack";
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID } from "../content/packs/meal/meal-scene-expansion-batch-02";
import type { ContextFrame, SemanticSkeleton } from "../domain/types";
import { MEAL_FRAMES } from "../fixtures/meal/contexts";
import { MEAL_BATCH_02_FRAMES } from "../fixtures/meal/meal-batch-02-contexts";
import { mealBatch02Skeleton } from "../fixtures/meal/meal-batch-02-skeleton";
import { mealSkeleton } from "../fixtures/meal/skeleton";

export type MealRuntimeContextId = "MEAL_BASE" | "MEAL_BATCH_02";

export function mealRuntimeContextIdForPack(packId: string): MealRuntimeContextId {
  return packId === MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID
    ? "MEAL_BATCH_02"
    : "MEAL_BASE";
}

export function experimentalMealRuntimeContextId(): MealRuntimeContextId {
  return mealRuntimeContextIdForPack(experimentalMealContextLabPack().id);
}

export function framesForMealRuntime(
  runtimeContextId: MealRuntimeContextId,
): readonly ContextFrame[] {
  return runtimeContextId === "MEAL_BATCH_02" ? MEAL_BATCH_02_FRAMES : MEAL_FRAMES;
}

export function skeletonForMealRuntime(
  runtimeContextId: MealRuntimeContextId,
): SemanticSkeleton {
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
