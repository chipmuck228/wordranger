/**
 * Scene Content registry. Runtime may load APPROVED_FOR_EXPERIMENT only.
 */

import { SceneContentErrorCode } from "./errors";
import { MEAL_SCENE_CONTENT_PACK } from "./packs/meal/meal-scene-content";
import type {
  ContextualSceneContentPack,
  ContextualSceneContentRegistryEntry,
  SceneContentRegistryStatus,
} from "./types";

const ENTRIES: ContextualSceneContentRegistryEntry[] = [
  {
    packId: MEAL_SCENE_CONTENT_PACK.id,
    status: "APPROVED_FOR_EXPERIMENT",
    pack: MEAL_SCENE_CONTENT_PACK,
  },
];

export function listSceneContentRegistry(): readonly ContextualSceneContentRegistryEntry[] {
  return ENTRIES.map((entry) => ({ ...entry, pack: entry.pack }));
}

export function getApprovedExperimentSceneContent(
  packId: string,
):
  | { ok: true; pack: ContextualSceneContentPack }
  | { ok: false; reason: typeof SceneContentErrorCode.CONTENT_REGISTRY_UNAPPROVED } {
  const matches = ENTRIES.filter((entry) => entry.packId === packId);
  if (matches.length !== 1) {
    return { ok: false, reason: SceneContentErrorCode.CONTENT_REGISTRY_UNAPPROVED };
  }
  const entry = matches[0]!;
  if (entry.status !== "APPROVED_FOR_EXPERIMENT") {
    return { ok: false, reason: SceneContentErrorCode.CONTENT_REGISTRY_UNAPPROVED };
  }
  return { ok: true, pack: entry.pack };
}

export function registryStatusFor(packId: string): SceneContentRegistryStatus | null {
  return ENTRIES.find((entry) => entry.packId === packId)?.status ?? null;
}
