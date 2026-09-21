/**
 * Meal Context Lab reads the fingerprint-bound experiment pack when
 * it is APPROVED_FOR_EXPERIMENT. The original four-word pack remains.
 */

import { MEAL_SCENE_CONTENT_PACK } from "./packs/meal/meal-scene-content";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "./packs/meal/meal-scene-expansion-batch-01";
import { getApprovedExperimentSceneContent } from "./scene-content-registry";
import type { ContextualSceneContentPack } from "./types";

export function experimentalMealContextLabPack(): ContextualSceneContentPack {
  const expansion = getApprovedExperimentSceneContent(
    MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
  );
  if (expansion.ok) {
    return expansion.pack;
  }
  const original = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
  if (original.ok) {
    return original.pack;
  }
  throw new Error("No Meal Scene Content pack is approved for experiment");
}
