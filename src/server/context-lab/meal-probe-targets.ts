import "server-only";

import type { ContextualProbeTarget } from "@/contextual-learning/candidate-v0/probe/types";
import { HOME_BREAKFAST_FRAME_ID } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { experimentalMealContextLabPack } from "@/contextual-learning/candidate-v0/content/experimental-meal-runtime-pack";
import { snapshotSceneContentFromPack } from "@/contextual-learning/candidate-v0/content/snapshot-from-pack";
import { projectProbeTargets } from "@/contextual-learning/candidate-v0/content/project-from-resolved";

export function mealColdProbeTargets(): ContextualProbeTarget[] {
  const snapshot = snapshotSceneContentFromPack(
    experimentalMealContextLabPack(),
    HOME_BREAKFAST_FRAME_ID,
  );
  if (!snapshot) {
    throw new Error("Meal Scene Content snapshot is missing the home breakfast frame");
  }
  return projectProbeTargets(snapshot);
}
