import { cloneFrozen } from "../content/immutable";
import type {
  ContextualContentReleaseManifest,
  ReleaseContextSnapshot,
  ReleaseTargetEntry,
} from "./types";
import {
  CONTEXTUAL_CONTENT_RELEASE_KIND,
  CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION,
  RELEASE_ID_PATTERN,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTarget(value: unknown): value is ReleaseTargetEntry["target"] {
  return (
    isRecord(value) &&
    typeof value.lexemeId === "string" &&
    value.lexemeId.length > 0 &&
    typeof value.senseId === "string" &&
    value.senseId.length > 0
  );
}

function parseTargetEntry(value: unknown): ReleaseTargetEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.reviewKey !== "string" ||
    !RELEASE_ID_PATTERN.test(value.reviewKey) ||
    typeof value.packId !== "string" ||
    !isTarget(value.target) ||
    typeof value.displayLabel !== "string" ||
    typeof value.contentFingerprint !== "string" ||
    !Number.isInteger(value.reviewRevision) ||
    (value.reviewRevision as number) < 0 ||
    (value.humanDecision !== "APPROVED" && value.humanDecision !== "LEGACY_BASELINE") ||
    (value.selectedMeaning !== null && typeof value.selectedMeaning !== "string") ||
    !Array.isArray(value.sourceRefs) ||
    !value.sourceRefs.every((item) => typeof item === "string") ||
    (value.approvalBasis !== "LEGACY_EXPERIMENT_BASELINE" &&
      value.approvalBasis !== "HUMAN_REVIEW_PROMOTION")
  ) {
    return null;
  }
  return {
    reviewKey: value.reviewKey,
    packId: value.packId,
    target: { lexemeId: value.target.lexemeId, senseId: value.target.senseId },
    displayLabel: value.displayLabel,
    contentFingerprint: value.contentFingerprint,
    reviewRevision: value.reviewRevision as number,
    humanDecision: value.humanDecision,
    selectedMeaning: value.selectedMeaning,
    sourceRefs: [...value.sourceRefs],
    approvalBasis: value.approvalBasis,
  };
}

function parseContextSnapshot(value: unknown): ReleaseContextSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    (value.runtimeContextId !== "MEAL_BASE" && value.runtimeContextId !== "MEAL_BATCH_02") ||
    !Array.isArray(value.frames) ||
    !isRecord(value.skeleton)
  ) {
    return null;
  }
  return {
    runtimeContextId: value.runtimeContextId,
    frames: value.frames as unknown as ReleaseContextSnapshot["frames"],
    skeleton: value.skeleton as unknown as ReleaseContextSnapshot["skeleton"],
  };
}

export function parseReleaseManifest(
  value: unknown,
): ContextualContentReleaseManifest | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.schemaVersion !== CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION) {
    return null;
  }
  if (value.kind !== CONTEXTUAL_CONTENT_RELEASE_KIND) {
    return null;
  }
  if (typeof value.releaseId !== "string" || !RELEASE_ID_PATTERN.test(value.releaseId)) {
    return null;
  }
  if (typeof value.sceneId !== "string" || !value.sceneId.trim()) {
    return null;
  }
  if (value.baseReleaseId !== null && typeof value.baseReleaseId !== "string") {
    return null;
  }
  if (
    value.status !== "DRAFT" &&
    value.status !== "PREFLIGHT_VALIDATED" &&
    value.status !== "PUBLISHED" &&
    value.status !== "SUPERSEDED" &&
    value.status !== "ROLLED_BACK"
  ) {
    return null;
  }
  if (!Number.isInteger(value.revision) || (value.revision as number) < 0) {
    return null;
  }
  if (!Array.isArray(value.targetEntries)) {
    return null;
  }
  const targetEntries = value.targetEntries.map(parseTargetEntry);
  if (targetEntries.some((item) => item === null)) {
    return null;
  }
  if (!isRecord(value.packSnapshot) || typeof value.packSnapshot.id !== "string") {
    return null;
  }
  const contextSnapshot = parseContextSnapshot(value.contextSnapshot);
  if (!contextSnapshot) {
    return null;
  }
  if (
    typeof value.packFingerprint !== "string" ||
    typeof value.contextModelFingerprint !== "string" ||
    typeof value.releaseFingerprint !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.createdBy !== "string" ||
    (value.validatedAt !== null && typeof value.validatedAt !== "string") ||
    (value.publishedAt != null && typeof value.publishedAt !== "string") ||
    (value.publishedBy != null && typeof value.publishedBy !== "string") ||
    (value.supersededAt != null && typeof value.supersededAt !== "string") ||
    (value.supersededByReleaseId != null &&
      typeof value.supersededByReleaseId !== "string")
  ) {
    return null;
  }
  return cloneFrozen({
    schemaVersion: CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION,
    kind: CONTEXTUAL_CONTENT_RELEASE_KIND,
    releaseId: value.releaseId,
    sceneId: value.sceneId,
    baseReleaseId: value.baseReleaseId,
    status: value.status,
    revision: value.revision as number,
    targetEntries: targetEntries as ReleaseTargetEntry[],
    packSnapshot: value.packSnapshot as unknown as ContextualContentReleaseManifest["packSnapshot"],
    contextSnapshot,
    packFingerprint: value.packFingerprint,
    contextModelFingerprint: value.contextModelFingerprint,
    releaseFingerprint: value.releaseFingerprint,
    createdAt: value.createdAt,
    createdBy: value.createdBy,
    validatedAt: value.validatedAt,
    publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : null,
    publishedBy: typeof value.publishedBy === "string" ? value.publishedBy : null,
    supersededAt: typeof value.supersededAt === "string" ? value.supersededAt : null,
    supersededByReleaseId:
      typeof value.supersededByReleaseId === "string" ? value.supersededByReleaseId : null,
    validationSummary:
      value.validationSummary && isRecord(value.validationSummary)
        ? {
            ok: value.validationSummary.ok === true,
            issues: Array.isArray(value.validationSummary.issues)
              ? value.validationSummary.issues
              : [],
          }
        : null,
  });
}
