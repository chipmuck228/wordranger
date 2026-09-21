/**
 * Meal Context Lab reads the fingerprint-bound experiment pack when
 * it is APPROVED_FOR_EXPERIMENT. The original four-word pack remains.
 */

import { MEAL_SCENE_CONTENT_PACK } from "./packs/meal/meal-scene-content";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "./packs/meal/meal-scene-expansion-batch-01";
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK } from "./packs/meal/meal-scene-expansion-batch-02";
import { getApprovedExperimentSceneContent } from "./scene-content-registry";
import type { ContextualSceneContentPack } from "./types";

export function experimentalMealContextLabPack(): ContextualSceneContentPack {
  const batch02 = getApprovedExperimentSceneContent(
    MEAL_SCENE_EXPANSION_BATCH_02_PACK.id,
  );
  if (batch02.ok) {
    return batch02.pack;
  }
  const batch01 = getApprovedExperimentSceneContent(
    MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
  );
  if (batch01.ok) {
    return batch01.pack;
  }
  const original = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
  if (original.ok) {
    return original.pack;
  }
  throw new Error("No Meal Scene Content pack is approved for experiment");
}
