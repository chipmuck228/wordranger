import "server-only";

import {
  currentPackTargetFingerprint,
  validateSceneContent,
} from "@/contextual-learning/candidate-v0/content";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { listFrozenRuntimeCapabilities } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { validateContextFrame } from "@/contextual-learning/candidate-v0/validation/validate-context-frame";
import { validateSemanticSkeleton } from "@/contextual-learning/candidate-v0/validation/validate-semantic-skeleton";
import {
  fingerprintsForManifest,
  parseReleaseManifest,
  validateDraftRelease,
  validateReleaseTransition,
  type ContextualContentReleaseManifest,
  type ReleaseValidationIssue,
} from "@/contextual-learning/candidate-v0/release";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { buildMealMigrationAuthority } from "./authority";
import { createContextualReleaseRepository } from "./create-release-runtime";
import { isContextualContentReleaseWriteEnabled } from "./gates";
import type { ContextualContentReleaseRepository } from "./release-repository";
import type { ReleasePreflightResult } from "./types";

function issue(
  code: ReleaseValidationIssue["code"],
  pathName: string,
  detail: string,
): ReleaseValidationIssue {
  return { code, path: pathName, detail };
}

function authoredFrames(manifest: ContextualContentReleaseManifest) {
  return manifest.contextSnapshot.frames.filter((frame) => frame.id !== "picnic-lunch-v0");
}

export async function preflightContextualContentRelease(input: {
  releaseId: string;
  revision: number;
  env?: Record<string, string | undefined>;
  now?: string;
  repository?: ContextualContentReleaseRepository;
  reviewRepository?: ContentReviewRepository;
}): Promise<ReleasePreflightResult> {
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
  const existing = await repository.get(input.releaseId);
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
  if (existing.status === "PUBLISHED") {
    issues.push(issue("RELEASE_TRANSITION_ILLEGAL", "status", "Client cannot request PUBLISHED."));
  }
  const draftCheck = validateDraftRelease(existing);
  issues.push(...draftCheck.issues);
  const authority = await buildMealMigrationAuthority({
    reviewRepository: input.reviewRepository ?? fileContentReviewRepository,
  });
  issues.push(...authority.issues);
  if (existing.packSnapshot.id !== authority.livePack.id) {
    issues.push(issue("RELEASE_PACK_MISMATCH", "packSnapshot.id", "Release pack is not the current experimental pack."));
  }
  const livePrint = fingerprintsForManifest({
    ...existing,
    packSnapshot: authority.snapshot.pack,
    contextSnapshot: authority.snapshot.context,
    targetEntries: authority.targetEntries,
    packFingerprint: existing.packFingerprint,
    contextModelFingerprint: existing.contextModelFingerprint,
    releaseFingerprint: existing.releaseFingerprint,
  });
  const storedPrint = fingerprintsForManifest(existing);
  if (storedPrint.packFingerprint !== livePrint.packFingerprint) {
    issues.push(issue("RELEASE_FINGERPRINT_DRIFT", "packFingerprint", "Current pack content drifted from the draft snapshot."));
  }
  if (storedPrint.contextModelFingerprint !== livePrint.contextModelFingerprint) {
    issues.push(issue("RELEASE_CONTEXT_MISMATCH", "contextModelFingerprint", "Current frames or skeleton drifted."));
  }
  if (authority.targetEntries.length !== existing.targetEntries.length) {
    issues.push(issue("RELEASE_PACK_MISMATCH", "targetEntries", "Live target set no longer matches the draft."));
  }
  for (const [index, entry] of existing.targetEntries.entries()) {
    const live = authority.targetEntries.find((item) => item.reviewKey === entry.reviewKey);
    if (!live) {
      issues.push(issue("RELEASE_REVIEW_MISSING", `targetEntries.${index}`, `Missing live target ${entry.reviewKey}.`));
      continue;
    }
    if (live.contentFingerprint !== entry.contentFingerprint) {
      issues.push(issue("RELEASE_FINGERPRINT_DRIFT", `targetEntries.${index}.contentFingerprint`, "Target content fingerprint drifted."));
    }
    if (live.reviewRevision !== entry.reviewRevision) {
      issues.push(issue("RELEASE_REVIEW_STALE", `targetEntries.${index}.reviewRevision`, "Review revision drifted."));
    }
    if (live.selectedMeaning !== entry.selectedMeaning) {
      issues.push(issue("RELEASE_MEANING_INVALID", `targetEntries.${index}.selectedMeaning`, "Selected meaning drifted."));
    }
    if (!sameLexemeSense(live.target, entry.target)) {
      issues.push(issue("RELEASE_SENSE_UNRESOLVED", `targetEntries.${index}.target`, "Exact sense no longer matches."));
    }
    const current = currentPackTargetFingerprint(authority.snapshot.pack, entry.target);
    if (current !== entry.contentFingerprint) {
      issues.push(issue("RELEASE_FINGERPRINT_DRIFT", `targetEntries.${index}`, "Snapshot target fingerprint is not current."));
    }
  }
  const skeletonCheck = validateSemanticSkeleton(existing.contextSnapshot.skeleton);
  if (!skeletonCheck.ok) {
    issues.push(issue("RELEASE_SKELETON_INVALID", "contextSnapshot.skeleton", "Skeleton validator failed."));
  }
  for (const frame of authoredFrames(existing)) {
    const frameCheck = validateContextFrame({
      frame,
      skeleton: existing.contextSnapshot.skeleton,
    });
    if (!frameCheck.ok) {
      issues.push(issue("RELEASE_FRAME_INVALID", frame.id, "Frame validator failed."));
    }
    const packCheck = validateSceneContent({
      pack: existing.packSnapshot,
      frame,
      frames: authoredFrames(existing),
      skeleton: existing.contextSnapshot.skeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    if (!packCheck.ok) {
      issues.push(issue("RELEASE_PACK_INVALID", frame.id, "Pack validator failed."));
    }
  }
  if (listFrozenRuntimeCapabilities().length === 0) {
    issues.push(issue("RELEASE_CAPABILITY_GAP", "capabilities", "Frozen runtime capabilities are insufficient."));
  }
  if (JSON.stringify(existing).includes("/train") && existing.packSnapshot.planning.sourceLearningNeedRef === "/train") {
    issues.push(issue("RELEASE_TRAIN_WIRED", "train", "/train must stay unwired."));
  }
  try {
    JSON.parse(JSON.stringify(existing.packSnapshot));
    JSON.parse(JSON.stringify(existing.contextSnapshot));
  } catch {
    issues.push(issue("RELEASE_SNAPSHOT_UNSERIALIZABLE", "snapshot", "Release snapshot cannot be serialized."));
  }
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
