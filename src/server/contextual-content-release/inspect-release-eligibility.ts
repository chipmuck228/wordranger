import { listSceneContentRegistry } from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import {
  resolveReleaseEligiblePack,
  type ReleaseValidationIssue,
} from "@/contextual-learning/candidate-v0/release";
import {
  buildMealMigrationAuthority,
  uniquePackTargets,
  type ReleaseAssemblyOptions,
} from "./authority";

export interface ReleaseEligibilityInspection {
  packId: string | null;
  parentPackId: string | null;
  targetCount: number;
  legacyCount: number;
  humanApprovedCount: number;
  unresolvedCount: number;
  staleReviewCount: number;
  unusedSourceCount: number;
  lineageOk: boolean;
  eligibilityOk: boolean;
  canCreateDraft: boolean;
  issues: ReleaseValidationIssue[];
}

const BLOCKING_CODES = new Set<ReleaseValidationIssue["code"]>([
  "RELEASE_REVIEW_MISSING",
  "RELEASE_REVIEW_STALE",
  "RELEASE_FINGERPRINT_DRIFT",
  "RELEASE_SENSE_UNRESOLVED",
  "RELEASE_REVIEW_INVALID",
  "RELEASE_LEGACY_FORGED",
  "RELEASE_TARGET_UNAPPROVED",
  "RELEASE_ELIGIBILITY_AMBIGUOUS",
  "RELEASE_LINEAGE_INVALID",
  "RELEASE_LINEAGE_CYCLE",
  "RELEASE_REMOVAL_UNSUPPORTED",
  "RELEASE_DUPLICATE_TARGET",
  "RELEASE_DUPLICATE_SENSE",
  "RELEASE_TARGET_ORDER",
  "RELEASE_PACK_MISMATCH",
  "RELEASE_PROMOTION_INVALID",
  "RELEASE_MEANING_INVALID",
  "RELEASE_CAPABILITY_GAP",
]);

export function draftCreationBlocked(issues: readonly ReleaseValidationIssue[]): boolean {
  return issues.some((item) => BLOCKING_CODES.has(item.code));
}

export async function inspectMealReleaseEligibility(
  input: ReleaseAssemblyOptions = {},
): Promise<ReleaseEligibilityInspection> {
  const registry = input.registry ?? listSceneContentRegistry();
  const selected = resolveReleaseEligiblePack({
    sceneClusterId: MEAL_SCENE_CLUSTER.id,
    registry,
  });
  const authority = await buildMealMigrationAuthority(input);
  const pack = input.pack ?? selected.entry?.pack ?? authority.livePack;
  const uniqueTargets = uniquePackTargets(pack);
  const unresolvedCount = Math.max(0, uniqueTargets.length - authority.targetEntries.length);
  const staleReviewCount = authority.issues.filter((item) => item.code === "RELEASE_REVIEW_STALE").length;
  const lineageOk = !authority.issues.some(
    (item) =>
      item.code === "RELEASE_LINEAGE_INVALID" ||
      item.code === "RELEASE_LINEAGE_CYCLE" ||
      item.code === "RELEASE_REMOVAL_UNSUPPORTED",
  );
  const issues = [...selected.issues, ...authority.issues];
  const canCreateDraft =
    selected.ok &&
    lineageOk &&
    unresolvedCount === 0 &&
    uniqueTargets.length >= 1 &&
    authority.targetEntries.length === uniqueTargets.length &&
    authority.historicalApprovalBindings.length === authority.targetEntries.length &&
    !draftCreationBlocked(issues);
  return {
    packId: selected.entry?.packId ?? pack.id,
    parentPackId: selected.entry?.parentPackId ?? registry.find((entry) => entry.packId === pack.id)?.parentPackId ?? null,
    targetCount: uniqueTargets.length,
    legacyCount: authority.targetEntries.filter((item) => item.approvalBasis === "LEGACY_EXPERIMENT_BASELINE").length,
    humanApprovedCount: authority.targetEntries.filter((item) => item.approvalBasis === "HUMAN_REVIEW_PROMOTION").length,
    unresolvedCount,
    staleReviewCount,
    unusedSourceCount: authority.unusedSources.length,
    lineageOk,
    eligibilityOk: selected.ok,
    canCreateDraft,
    issues,
  };
}
