import "server-only";

import {
  parseReleaseManifest,
  validateReleaseTransition,
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
import type { ReleasePreflightResult } from "./types";

function issue(
  code: ReleaseValidationIssue["code"],
  pathName: string,
  detail: string,
): ReleaseValidationIssue {
  return { code, path: pathName, detail };
}

export async function preflightContextualContentRelease(
  input: ReleaseAssemblyOptions & {
    releaseId: string;
    revision: number;
    env?: Record<string, string | undefined>;
    now?: string;
    repository?: ContextualContentReleaseRepository;
  },
): Promise<ReleasePreflightResult> {
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
      message: "Preflight accepts only releaseId and revision.",
      issues: [issue("RELEASE_CLIENT_FORBIDDEN_FIELD", "request", "Invalid preflight identity.")],
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
  if (existing.revision !== input.revision) {
    return {
      ok: false,
      code: "RELEASE_CONFLICT",
      message: "Another release write happened first.",
      issues: [issue("RELEASE_IMMUTABLE_MUTATION", "revision", "Stale release revision.")],
      record: existing,
    };
  }
  const issues: ReleaseValidationIssue[] = [];
  if (existing.status === "PUBLISHED" || existing.status === "SUPERSEDED") {
    issues.push(issue("RELEASE_TRANSITION_ILLEGAL", "status", "A published snapshot cannot be preflighted again."));
  }
  issues.push(
    ...(await evaluatePublishReadiness({
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
      promotionRepository: input.promotionRepository,
      env: input.env,
    })),
  );
  if (issues.length > 0) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: issues[0]!.detail,
      issues,
      record: existing,
    };
  }
  if (existing.status === "PREFLIGHT_VALIDATED") {
    return { ok: true, record: existing, idempotent: true, issues: [] };
  }
  const now = input.now ?? new Date().toISOString();
  const next: ContextualContentReleaseManifest = {
    ...existing,
    status: "PREFLIGHT_VALIDATED",
    validatedAt: now,
    validationSummary: { ok: true, issues: [] },
  };
  const transition = validateReleaseTransition({
    current: existing,
    next,
    requestedStatus: "PREFLIGHT_VALIDATED",
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
      message: "Validated manifest could not be reparsed.",
      issues: [issue("RELEASE_SCHEMA_INVALID", "manifest", "Validated manifest could not be reparsed.")],
      record: existing,
    };
  }
  const saved = await repository.saveIfRevision({
    record: parsed,
    expectedRevision: input.revision,
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
  return { ok: true, record: saved.record, idempotent: saved.idempotent, issues: [] };
}
