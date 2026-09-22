import "server-only";

import {
  CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND,
  CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION,
  fingerprintsForManifest,
} from "@/contextual-learning/candidate-v0/release";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { createContextualReleaseRepository } from "./create-release-runtime";
import { evaluateReleaseReadiness } from "./evaluate-release-readiness";
import { isContextualContentReleaseWriteEnabled } from "./gates";
import type { ContextualContentReleaseRepository } from "./release-repository";
import { RELEASE_ACTOR_ID, type ReleaseRollbackResult } from "./types";

export async function rollbackContextualContentActiveRelease(input: {
  sceneId: string;
  expectedPointerRevision: number;
  targetReleaseId: string;
  env?: Record<string, string | undefined>;
  now?: string;
  repository?: ContextualContentReleaseRepository;
  reviewRepository?: ContentReviewRepository;
  pack?: ContextualSceneContentPack;
}): Promise<ReleaseRollbackResult> {
  if (!isContextualContentReleaseWriteEnabled(input.env)) {
    return {
      ok: false,
      code: "RELEASE_WRITE_DISABLED",
      message: "Release writes are disabled.",
    };
  }
  if (
    typeof input.sceneId !== "string" ||
    typeof input.targetReleaseId !== "string" ||
    !Number.isInteger(input.expectedPointerRevision) ||
    input.expectedPointerRevision < 0
  ) {
    return { ok: false, code: "RELEASE_INVALID", message: "Invalid rollback identity." };
  }
  const repository = input.repository ?? createContextualReleaseRepository(input.env);
  const pointer = await repository.getActivePointer(input.sceneId);
  const target = await repository.get(input.targetReleaseId);
  if (!pointer || !target) {
    return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
  }
  if (
    pointer.releaseId === target.releaseId &&
    pointer.releaseFingerprint === target.releaseFingerprint
  ) {
    return { ok: true, pointer, target, idempotent: true };
  }
  if (pointer.revision !== input.expectedPointerRevision) {
    return { ok: false, code: "RELEASE_CONFLICT", message: "Active pointer changed before rollback." };
  }
  if (target.sceneId !== input.sceneId) {
    return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
  }
  if (target.status !== "PUBLISHED" && target.status !== "SUPERSEDED") {
    return { ok: false, code: "RELEASE_NOT_PUBLISHED", message: "Only previously published releases can become active." };
  }
  if (target.publishedAt == null) {
    return { ok: false, code: "RELEASE_NOT_PUBLISHED", message: "Only previously published releases can become active." };
  }
  const computed = fingerprintsForManifest(target);
  if (computed.releaseFingerprint !== target.releaseFingerprint) {
    return { ok: false, code: "RELEASE_POINTER_MISMATCH", message: "Target release fingerprint cannot be recomputed." };
  }
  const issues = await evaluateReleaseReadiness({
    existing: target,
    reviewRepository: input.reviewRepository ?? fileContentReviewRepository,
    pack: input.pack,
  });
  if (issues.length > 0) {
    return { ok: false, code: "RELEASE_INVALID", message: issues[0]!.detail };
  }
  const now = input.now ?? new Date().toISOString();
  return repository.rollbackPointer({
    sceneId: input.sceneId,
    expectedPointerRevision: input.expectedPointerRevision,
    pointer: {
      schemaVersion: CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION,
      kind: CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND,
      sceneId: input.sceneId,
      releaseId: target.releaseId,
      releaseFingerprint: target.releaseFingerprint,
      revision: input.expectedPointerRevision + 1,
      activatedAt: now,
      activatedBy: RELEASE_ACTOR_ID,
    },
  });
}
