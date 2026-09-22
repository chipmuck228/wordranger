/**
 * Contextual Content Release Candidate V0.
 * Experimental / Not a Standard. Phase 2 publishes experimental Context Lab
 * content only. It is not a Standard and is not wired to /train.
 */

import type { ContextFrame, LexemeSenseRef, SemanticSkeleton } from "../domain/types";
import type { ContextualSceneContentPack, SceneContentApprovalBasis } from "../content/types";

export const CONTEXTUAL_CONTENT_RELEASE_KIND = "CANDIDATE_V0_CONTENT_RELEASE" as const;
export const CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION = "candidate-v0" as const;

export const MEAL_MIGRATION_RELEASE_ID = "meal-release-migration-v0";
export const MEAL_RELEASE_SCENE_ID = "meal-scene-v0";

export type ContextualContentReleaseStatus =
  | "DRAFT"
  | "PREFLIGHT_VALIDATED"
  | "PUBLISHED"
  | "SUPERSEDED"
  | "ROLLED_BACK";

export type ReleaseHumanDecision = "APPROVED" | "LEGACY_BASELINE";

export type ReleaseApprovalBasis = Extract<
  SceneContentApprovalBasis,
  "LEGACY_EXPERIMENT_BASELINE" | "HUMAN_REVIEW_PROMOTION"
>;

export interface ReleaseTargetEntry {
  reviewKey: string;
  packId: string;
  target: LexemeSenseRef;
  displayLabel: string;
  contentFingerprint: string;
  reviewRevision: number;
  humanDecision: ReleaseHumanDecision;
  selectedMeaning: string | null;
  sourceRefs: readonly string[];
  approvalBasis: ReleaseApprovalBasis;
}

export interface ReleaseContextSnapshot {
  runtimeContextId: "MEAL_BASE" | "MEAL_BATCH_02";
  frames: readonly ContextFrame[];
  skeleton: SemanticSkeleton;
}

export interface ReleaseSnapshot {
  pack: ContextualSceneContentPack;
  context: ReleaseContextSnapshot;
}

export interface ReleaseValidationIssue {
  code: ReleaseValidationIssueCode;
  path: string;
  detail: string;
}

export type ReleaseValidationIssueCode =
  | "RELEASE_SCHEMA_INVALID"
  | "RELEASE_STATUS_ILLEGAL"
  | "RELEASE_TRANSITION_ILLEGAL"
  | "RELEASE_IMMUTABLE_MUTATION"
  | "RELEASE_DUPLICATE_TARGET"
  | "RELEASE_DUPLICATE_SENSE"
  | "RELEASE_TARGET_ORDER"
  | "RELEASE_PACK_MISMATCH"
  | "RELEASE_CONTEXT_MISMATCH"
  | "RELEASE_FINGERPRINT_DRIFT"
  | "RELEASE_REVIEW_MISSING"
  | "RELEASE_REVIEW_STALE"
  | "RELEASE_REVIEW_INVALID"
  | "RELEASE_LEGACY_FORGED"
  | "RELEASE_SENSE_UNRESOLVED"
  | "RELEASE_MEANING_INVALID"
  | "RELEASE_PACK_INVALID"
  | "RELEASE_FRAME_INVALID"
  | "RELEASE_SKELETON_INVALID"
  | "RELEASE_PROMOTION_INVALID"
  | "RELEASE_CAPABILITY_GAP"
  | "RELEASE_TRAIN_WIRED"
  | "RELEASE_SNAPSHOT_UNSERIALIZABLE"
  | "RELEASE_CLIENT_FORBIDDEN_FIELD";

export interface ReleaseValidationSummary {
  ok: boolean;
  issues: readonly ReleaseValidationIssue[];
}

export interface ReleaseValidationResult {
  ok: boolean;
  issues: ReleaseValidationIssue[];
}

export interface ContextualContentReleaseManifest {
  schemaVersion: typeof CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION;
  kind: typeof CONTEXTUAL_CONTENT_RELEASE_KIND;
  releaseId: string;
  sceneId: string;
  baseReleaseId: string | null;
  status: ContextualContentReleaseStatus;
  revision: number;
  targetEntries: readonly ReleaseTargetEntry[];
  packSnapshot: ContextualSceneContentPack;
  contextSnapshot: ReleaseContextSnapshot;
  packFingerprint: string;
  contextModelFingerprint: string;
  releaseFingerprint: string;
  createdAt: string;
  createdBy: string;
  validatedAt: string | null;
  validationSummary: ReleaseValidationSummary | null;
  publishedAt: string | null;
  publishedBy: string | null;
  supersededAt: string | null;
  supersededByReleaseId: string | null;
}

export const CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND =
  "CANDIDATE_V0_ACTIVE_RELEASE_POINTER" as const;

export interface ContextualContentActiveReleasePointer {
  schemaVersion: typeof CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION;
  kind: typeof CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND;
  sceneId: string;
  releaseId: string;
  releaseFingerprint: string;
  revision: number;
  activatedAt: string;
  activatedBy: string;
}

export const PHASE1_ALLOWED_STATUSES = ["DRAFT", "PREFLIGHT_VALIDATED"] as const;
export const PUBLISHED_RELEASE_STATUSES = ["PUBLISHED", "SUPERSEDED"] as const;

export const RELEASE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
