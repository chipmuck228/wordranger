/**
 * Unique RELEASE_ELIGIBLE pack selection. Never picks latest or max id.
 */

import type { ContextualSceneContentRegistryEntry } from "../content/types";
import type { ReleaseValidationIssue, ReleaseValidationResult } from "./types";

export interface ReleaseEligiblePackSelection extends ReleaseValidationResult {
  entry: ContextualSceneContentRegistryEntry | null;
}

export function resolveReleaseEligiblePack(input: {
  sceneClusterId: string;
  registry: readonly ContextualSceneContentRegistryEntry[];
}): ReleaseEligiblePackSelection {
  const issues: ReleaseValidationIssue[] = [];
  const eligible = input.registry.filter(
    (entry) =>
      entry.pack.sceneClusterId === input.sceneClusterId &&
      entry.releaseEligibility === "RELEASE_ELIGIBLE" &&
      entry.status === "APPROVED_FOR_EXPERIMENT" &&
      entry.pack.schemaVersion === "candidate-v0" &&
      entry.pack.provenance.sourceRefs.length > 0,
  );
  if (eligible.length === 0) {
    issues.push({
      code: "RELEASE_PACK_MISMATCH",
      path: "releaseEligibility",
      detail: "No unique RELEASE_ELIGIBLE Meal Candidate pack is available.",
    });
    return { ok: false, entry: null, issues };
  }
  if (eligible.length > 1) {
    issues.push({
      code: "RELEASE_ELIGIBILITY_AMBIGUOUS",
      path: "releaseEligibility",
      detail: "Multiple RELEASE_ELIGIBLE packs exist; selection is fail-closed.",
    });
    return { ok: false, entry: null, issues };
  }
  return { ok: true, entry: eligible[0]!, issues: [] };
}
