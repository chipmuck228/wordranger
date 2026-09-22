import "server-only";

import {
  CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND,
  CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION,
  fingerprintsForManifest,
  parseReleaseManifest,
  validateReleaseTransition,
  type ContextualContentActiveReleasePointer,
  type ContextualContentReleaseManifest,
  type ReleaseValidationIssue,
} from "@/contextual-learning/candidate-v0/release";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import type { ReleaseAssemblyOptions } from "./authority";
import { createContextualReleaseRepository } from "./create-release-runtime";
import { evaluatePublishReadiness } from "./evaluate-release-readiness";
import { isContextualContentReleaseWriteEnabled } from "./gates";
import type { ContextualContentReleaseRepository } from "./release-repository";
import { ReleasePersistenceInconsistencyError } from "./row-manifest-consistency";
import { RELEASE_ACTOR_ID, type ReleasePublishResult } from "./types";

function issue(
  code: ReleaseValidationIssue["code"],
  pathName: string,
  detail: string,
): ReleaseValidationIssue {
  return { code, path: pathName, detail };
}

export async function publishContextualContentRelease(
  input: ReleaseAssemblyOptions & {
    releaseId: string;
    revision: number;
    env?: Record<string, string | undefined>;
    now?: string;
    repository?: ContextualContentReleaseRepository;
  },
): Promise<ReleasePublishResult> {
  if (!isContextualContentReleaseWriteEnabled(input.env)) {
    return {
      ok: false,
      code: "RELEASE_WRITE_DISABLED",
      message: "Release writes are disabled.",
      issues: [],
    };
  }
  if (typeof input.releaseId !== "string" || !Number.isInteger(input.revision) || input.revision < 0) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: "Publish accepts only releaseId and revision.",
      issues: [issue("RELEASE_CLIENT_FORBIDDEN_FIELD", "request", "Invalid publish identity.")],
    };
  }
  const repository = input.repository ?? createContextualReleaseRepository(input.env);
  let existing;
  try {
    existing = await repository.get(input.releaseId);
  } catch (error) {
    if (error instanceof ReleasePersistenceInconsistencyError) {
      return {
        ok: false,
        code: "RELEASE_RUNTIME_INVALID",
        message: error.message,
        issues: [issue("RELEASE_SCHEMA_INVALID", "manifest", error.message)],
      };
    }
    throw error;
  }
  if (!existing) {
    return {
      ok: false,
      code: "RELEASE_NOT_FOUND",
      message: "Release was not found.",
      issues: [],
    };
  }
  const pointer = await repository.getActivePointer(existing.sceneId);
  if (
    existing.status === "PUBLISHED" &&
    pointer?.releaseId === existing.releaseId &&
    pointer.releaseFingerprint === existing.releaseFingerprint
  ) {
    return { ok: true, record: existing, pointer, superseded: null, idempotent: true, issues: [] };
  }
  if (existing.revision !== input.revision) {
    return {
      ok: false,
      code: "RELEASE_CONFLICT",
      message: "Another release write happened first.",
      issues: [issue("RELEASE_IMMUTABLE_MUTATION", "revision", "Stale release revision.")],
      record: existing,
    };
  }
  if (existing.status !== "PREFLIGHT_VALIDATED") {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: "Only PREFLIGHT_VALIDATED releases can be published.",
      issues: [issue("RELEASE_TRANSITION_ILLEGAL", "status", "Only PREFLIGHT_VALIDATED releases can be published.")],
      record: existing,
    };
  }
  const issues = await evaluatePublishReadiness({
    existing,
    reviewRepository: input.reviewRepository ?? fileContentReviewRepository,
    loadLexeme: input.loadLexeme,
    pack: input.pack,
    registry: input.registry,
    extraApprovalSources: input.extraApprovalSources,
    extraPacks: input.extraPacks,
    extraReviewTargets: input.extraReviewTargets,
    context: input.context,
    parentPackId: input.parentPackId,
    capabilities: input.capabilities,
  });
  if (issues.length > 0) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: issues[0]!.detail,
      issues,
      record: existing,
    };
  }
  const now = input.now ?? new Date().toISOString();
  const next: ContextualContentReleaseManifest = {
    ...existing,
    status: "PUBLISHED",
    publishedAt: now,
    publishedBy: RELEASE_ACTOR_ID,
  };
  const transition = validateReleaseTransition({
    current: existing,
    next,
    requestedStatus: "PUBLISHED",
  });
  if (!transition.ok) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: transition.issues[0]!.detail,
      issues: transition.issues,
      record: existing,
    };
  }
  const parsed = parseReleaseManifest(next);
  if (!parsed) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: "Published manifest could not be reparsed.",
      issues: [issue("RELEASE_SCHEMA_INVALID", "manifest", "Published manifest could not be reparsed.")],
      record: existing,
    };
  }
  const computed = fingerprintsForManifest(parsed);
  if (computed.releaseFingerprint !== parsed.releaseFingerprint) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: "Stored release fingerprints no longer recompute.",
      issues: [issue("RELEASE_FINGERPRINT_DRIFT", "releaseFingerprint", "Stored release fingerprints no longer recompute.")],
      record: existing,
    };
  }

  let superseded:
    | { record: ContextualContentReleaseManifest; expectedRevision: number }
    | undefined;
  if (pointer && pointer.releaseId !== parsed.releaseId) {
    const previous = await repository.get(pointer.releaseId);
    if (!previous) {
      return {
        ok: false,
        code: "RELEASE_POINTER_INVALID",
        message: "Release was not found.",
        issues: [],
      };
    }
    superseded = {
      expectedRevision: previous.revision,
      record: {
        ...previous,
        status: "SUPERSEDED",
        supersededAt: now,
        supersededByReleaseId: parsed.releaseId,
      },
    };
  }

  const nextPointer: ContextualContentActiveReleasePointer = {
    schemaVersion: CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION,
    kind: CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND,
    sceneId: parsed.sceneId,
    releaseId: parsed.releaseId,
    releaseFingerprint: parsed.releaseFingerprint,
    revision: pointer ? pointer.revision + 1 : 0,
    activatedAt: now,
    activatedBy: RELEASE_ACTOR_ID,
  };

  const saved = await repository.publishAtomic({
    record: parsed,
    expectedRevision: input.revision,
    pointer: nextPointer,
    expectedPointerRevision: pointer ? pointer.revision : null,
    superseded,
  });
  if (!saved.ok) {
    return {
      ok: false,
      code: saved.code,
      message: saved.message,
      issues: [issue("RELEASE_IMMUTABLE_MUTATION", "revision", saved.message)],
      record: existing,
    };
  }
  return {
    ok: true,
    record: saved.record,
    pointer: saved.pointer,
    superseded: saved.superseded,
    idempotent: saved.idempotent,
    issues: [],
  };
}
