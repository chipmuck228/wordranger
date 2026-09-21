/**
 * Scene Content registry. Runtime may load APPROVED_FOR_EXPERIMENT only.
 * Approval basis is explicit. Pack IDs do not decide promotion rules.
 */

import { SceneContentErrorCode } from "./errors";
import { cloneFrozen, deepFreeze } from "./immutable";
import { matchesLegacyExperimentBaseline } from "./packs/meal/meal-legacy-experiment-baseline";
import { MEAL_SCENE_CONTENT_PACK } from "./packs/meal/meal-scene-content";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "./packs/meal/meal-scene-expansion-batch-01";
import { MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION } from "./packs/meal/meal-scene-expansion-batch-01-promotion";
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK } from "./packs/meal/meal-scene-expansion-batch-02";
import { MEAL_SCENE_EXPANSION_BATCH_02_PLATE_PROMOTION } from "./packs/meal/meal-scene-expansion-batch-02-promotion";
import { promotionAttestationMatchesPack } from "./validate-experiment-promotion";
import type {
  ContextualSceneContentPack,
  ContextualSceneContentRegistryEntry,
  SceneContentRegistryStatus,
} from "./types";

function approvedEntryIsBound(
  entry: ContextualSceneContentRegistryEntry,
): boolean {
  if (entry.approvalBasis === "LEGACY_EXPERIMENT_BASELINE") {
    return matchesLegacyExperimentBaseline(entry);
  }
  if (entry.approvalBasis === "HUMAN_REVIEW_PROMOTION") {
    return Boolean(entry.promotion) && promotionAttestationMatchesPack(entry);
  }
  return false;
}

function entryCompiles(entry: ContextualSceneContentRegistryEntry): boolean {
  if (!entry.packId || entry.packId !== entry.pack.id) {
    return false;
  }
  if (entry.status === "DRAFT" || entry.status === "CANDIDATE") {
    return !entry.approvalBasis && !entry.promotion;
  }
  if (entry.status === "APPROVED_FOR_EXPERIMENT") {
    return approvedEntryIsBound(entry);
  }
  return false;
}

function compileRegistry(
  entries: ContextualSceneContentRegistryEntry[],
): ContextualSceneContentRegistryEntry[] {
  const ids = new Set<string>();
  const compiled: ContextualSceneContentRegistryEntry[] = [];
  for (const entry of entries) {
    if (!entryCompiles(entry) || ids.has(entry.packId)) {
      continue;
    }
    ids.add(entry.packId);
    compiled.push(deepFreeze(structuredClone(entry)));
  }
  if (compiled.length !== entries.length) {
    return [];
  }
  return compiled;
}

const ENTRIES = compileRegistry([
  {
    packId: MEAL_SCENE_CONTENT_PACK.id,
    status: "APPROVED_FOR_EXPERIMENT",
    approvalBasis: "LEGACY_EXPERIMENT_BASELINE",
    pack: MEAL_SCENE_CONTENT_PACK,
  },
  {
    packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK.id,
    status: "APPROVED_FOR_EXPERIMENT",
    approvalBasis: "HUMAN_REVIEW_PROMOTION",
    pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
    promotion: MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
  },
  {
    packId: MEAL_SCENE_EXPANSION_BATCH_02_PACK.id,
    status: "APPROVED_FOR_EXPERIMENT",
    approvalBasis: "HUMAN_REVIEW_PROMOTION",
    pack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
    promotion: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_PROMOTION,
  },
]);

export function listSceneContentRegistry(): readonly ContextualSceneContentRegistryEntry[] {
  return ENTRIES.map((entry) => cloneFrozen(entry));
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
  if (entry.status !== "APPROVED_FOR_EXPERIMENT" || entry.packId !== entry.pack.id) {
    return { ok: false, reason: SceneContentErrorCode.CONTENT_REGISTRY_UNAPPROVED };
  }
  if (!approvedEntryIsBound(entry)) {
    return { ok: false, reason: SceneContentErrorCode.CONTENT_REGISTRY_UNAPPROVED };
  }
  return { ok: true, pack: cloneFrozen(entry.pack) };
}

export function registryStatusFor(packId: string): SceneContentRegistryStatus | null {
  return ENTRIES.find((entry) => entry.packId === packId)?.status ?? null;
}

export function registryEntryFor(
  packId: string,
): ContextualSceneContentRegistryEntry | null {
  const entry = ENTRIES.find((item) => item.packId === packId);
  return entry ? cloneFrozen(entry) : null;
}

export { compileRegistry as compileSceneContentRegistryForTests };
