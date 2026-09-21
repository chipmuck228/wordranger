/**
 * Immutable allowlist for the original four-word Meal experiment pack.
 * Claiming LEGACY_EXPERIMENT_BASELINE is not enough.
 */

import { fingerprintAuthoredPack } from "../../content-fingerprint";
import type { ContextualSceneContentRegistryEntry } from "../../types";
import { MEAL_SCENE_CONTENT_SOURCE_REFS } from "./meal-content-provenance";
import {
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_CONTENT_PACK_ID,
} from "./meal-scene-content";

export const MEAL_LEGACY_EXPERIMENT_BASELINE = Object.freeze({
  packId: MEAL_SCENE_CONTENT_PACK_ID,
  provenance: Object.freeze({
    status: "APPROVED_FOR_EXPERIMENT" as const,
    sourceRefs: Object.freeze([...MEAL_SCENE_CONTENT_SOURCE_REFS]),
  }),
  contentFingerprint:
    "9ffceb59f31933c78505f06197777c17d57efe50aa8ee399259169070b6cf517",
});

function sameSourceRefs(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((item, index) => item === expected[index])
  );
}

export function matchesLegacyExperimentBaseline(
  entry: ContextualSceneContentRegistryEntry,
): boolean {
  if (entry.approvalBasis !== "LEGACY_EXPERIMENT_BASELINE") {
    return false;
  }
  if (entry.promotion) {
    return false;
  }
  if (
    entry.packId !== MEAL_LEGACY_EXPERIMENT_BASELINE.packId ||
    entry.pack.id !== MEAL_LEGACY_EXPERIMENT_BASELINE.packId
  ) {
    return false;
  }
  if (entry.pack.provenance.status !== MEAL_LEGACY_EXPERIMENT_BASELINE.provenance.status) {
    return false;
  }
  if (
    !sameSourceRefs(
      entry.pack.provenance.sourceRefs,
      MEAL_LEGACY_EXPERIMENT_BASELINE.provenance.sourceRefs,
    )
  ) {
    return false;
  }
  return (
    fingerprintAuthoredPack(entry.pack) ===
    MEAL_LEGACY_EXPERIMENT_BASELINE.contentFingerprint
  );
}

export function liveLegacyExperimentBaselineFingerprint(): string {
  return fingerprintAuthoredPack(MEAL_SCENE_CONTENT_PACK);
}
