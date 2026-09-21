import "server-only";

import type { ContextualProbeTarget } from "@/contextual-learning/candidate-v0/probe/types";
import { MEAL_SCENE_CONTENT_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { HOME_BREAKFAST_FRAME_ID } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { snapshotSceneContentFromPack } from "@/contextual-learning/candidate-v0/content/snapshot-from-pack";
import { projectProbeTargets } from "@/contextual-learning/candidate-v0/content/project-from-resolved";
import { getApprovedExperimentSceneContent } from "@/contextual-learning/candidate-v0/content/scene-content-registry";

export function mealColdProbeTargets(): ContextualProbeTarget[] {
  const approved = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
  if (!approved.ok) {
    throw new Error("Meal Scene Content pack is not approved for experiment");
  }
  const snapshot = snapshotSceneContentFromPack(
    approved.pack,
    HOME_BREAKFAST_FRAME_ID,
  );
  if (!snapshot) {
    throw new Error("Meal Scene Content snapshot is missing the home breakfast frame");
  }
  return projectProbeTargets(snapshot);
}
