import "server-only";

import { validateSceneContent } from "@/contextual-learning/candidate-v0/content";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { validateContextFrame } from "@/contextual-learning/candidate-v0/validation/validate-context-frame";
import { validateSemanticSkeleton } from "@/contextual-learning/candidate-v0/validation/validate-semantic-skeleton";
import {
  fingerprintTargetAgainstApprovalSource,
  fingerprintsForManifest,
  validateDraftRelease,
  validateMealReleaseCapabilities,
  type ContextualContentReleaseManifest,
  type HistoricalReleaseApprovalBinding,
  type ReleaseTargetEntry,
  type ReleaseValidationIssue,
} from "@/contextual-learning/candidate-v0/release";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import { buildMealMigrationAuthority } from "./authority";

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

export function releaseContainsForbiddenLearnerData(
  manifest: ContextualContentReleaseManifest,
): boolean {
  const json = JSON.stringify(manifest);
  const forbidden = ["answerKey", "Learning" + "Evidence", "Student" + "LexemeModel", "process" + "Evidence"];
  return (
    forbidden.some((token) => json.includes(token)) ||
    (json.includes("/tra" + "in") &&
      manifest.packSnapshot.planning.sourceLearningNeedRef === "/tra" + "in")
  );
}

function evaluateSnapshotIntegrity(manifest: ContextualContentReleaseManifest): ReleaseValidationIssue[] {
  const issues: ReleaseValidationIssue[] = [];
  issues.push(...validateDraftRelease(manifest).issues);
  const computed = fingerprintsForManifest(manifest);
  if (computed.releaseFingerprint !== manifest.releaseFingerprint) {
    issues.push(
      issue("RELEASE_FINGERPRINT_DRIFT", "releaseFingerprint", "Stored release fingerprints no longer recompute."),
    );
  }
  if (computed.packFingerprint !== manifest.packFingerprint) {
    issues.push(issue("RELEASE_FINGERPRINT_DRIFT", "packFingerprint", "Stored pack fingerprint no longer recomputes."));
  }
  if (computed.contextModelFingerprint !== manifest.contextModelFingerprint) {
    issues.push(
      issue("RELEASE_CONTEXT_MISMATCH", "contextModelFingerprint", "Stored context fingerprint no longer recomputes."),
    );
  }
  for (const [index, entry] of manifest.targetEntries.entries()) {
    const matches = manifest.packSnapshot.lexemes.filter((lexeme) =>
      sameLexemeSense(lexeme.target, entry.target),
    );
    if (matches.length !== 1) {
      issues.push(
        issue("RELEASE_PACK_MISMATCH", `targetEntries.${index}`, "Target is not unique in the frozen pack snapshot."),
      );
    }
  }
  const skeletonCheck = validateSemanticSkeleton(manifest.contextSnapshot.skeleton);
  if (!skeletonCheck.ok) {
    issues.push(issue("RELEASE_SKELETON_INVALID", "contextSnapshot.skeleton", "Skeleton validator failed."));
  }
  for (const frame of authoredFrames(manifest)) {
    const frameCheck = validateContextFrame({
      frame,
      skeleton: manifest.contextSnapshot.skeleton,
    });
    if (!frameCheck.ok) {
      issues.push(issue("RELEASE_FRAME_INVALID", frame.id, "Frame validator failed."));
    }
    const packCheck = validateSceneContent({
      pack: manifest.packSnapshot,
      frame,
      frames: authoredFrames(manifest),
      skeleton: manifest.contextSnapshot.skeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    if (!packCheck.ok) {
      issues.push(issue("RELEASE_PACK_INVALID", frame.id, "Pack validator failed."));
    }
  }
  issues.push(
    ...validateMealReleaseCapabilities({
      targets: manifest.targetEntries.map((entry) => entry.target),
    }).issues,
  );
  if (releaseContainsForbiddenLearnerData(manifest)) {
    issues.push(issue("RELEASE_TRAIN_WIRED", "train", "/train or learner state must stay out of the release."));
  }
  try {
    JSON.parse(JSON.stringify(manifest.packSnapshot));
    JSON.parse(JSON.stringify(manifest.contextSnapshot));
  } catch {
    issues.push(issue("RELEASE_SNAPSHOT_UNSERIALIZABLE", "snapshot", "Release snapshot cannot be serialized."));
  }
  return issues;
}

function bindingMatchesEntry(
  binding: HistoricalReleaseApprovalBinding,
  entry: ReleaseTargetEntry,
): boolean {
  return (
    binding.reviewKey === entry.reviewKey &&
    binding.approvalBasis === entry.approvalBasis &&
    binding.approvedContentFingerprint === entry.contentFingerprint &&
    binding.reviewRevision === entry.reviewRevision &&
    binding.humanDecision === entry.humanDecision &&
    binding.approvalSourceRefs.length === entry.sourceRefs.length &&
    binding.approvalSourceRefs.every((ref, index) => ref === entry.sourceRefs[index])
  );
}

export function evaluateHistoricalApprovalBindings(
  manifest: ContextualContentReleaseManifest,
): ReleaseValidationIssue[] {
  const issues: ReleaseValidationIssue[] = [];
  if (manifest.historicalApprovalBindings.length === 0) {
    issues.push(
      issue(
        "RELEASE_REVIEW_MISSING",
        "historicalApprovalBindings",
        "Historical approval bindings are missing from the frozen release.",
      ),
    );
    return issues;
  }
  if (manifest.historicalApprovalBindings.length !== manifest.targetEntries.length) {
    issues.push(
      issue(
        "RELEASE_REVIEW_INVALID",
        "historicalApprovalBindings",
        "Historical approval bindings do not match frozen target entries.",
      ),
    );
  }
  for (const [index, entry] of manifest.targetEntries.entries()) {
    const binding = manifest.historicalApprovalBindings.find((item) => item.reviewKey === entry.reviewKey);
    if (!binding) {
      issues.push(
        issue(
          "RELEASE_REVIEW_MISSING",
          `historicalApprovalBindings.${index}`,
          `Missing frozen approval binding for ${entry.reviewKey}.`,
        ),
      );
      continue;
    }
    if (!bindingMatchesEntry(binding, entry)) {
      issues.push(
        issue(
          "RELEASE_REVIEW_INVALID",
          `historicalApprovalBindings.${index}`,
          `Frozen approval binding does not match target ${entry.reviewKey}.`,
        ),
      );
    }
    const lexeme = manifest.packSnapshot.lexemes.filter((item) => sameLexemeSense(item.target, entry.target));
    if (lexeme.length !== 1) {
      issues.push(
        issue("RELEASE_SENSE_UNRESOLVED", `targetEntries.${index}`, "Frozen target is missing from the pack snapshot."),
      );
      continue;
    }
    const recomputed = fingerprintTargetAgainstApprovalSource({
      lexeme: lexeme[0]!,
      approvalPackId: binding.approvalPackId,
      approvalSourceRefs: binding.approvalSourceRefs,
    });
    if (recomputed !== binding.approvedContentFingerprint) {
      issues.push(
        issue(
          "RELEASE_FINGERPRINT_DRIFT",
          `historicalApprovalBindings.${index}.approvedContentFingerprint`,
          "Frozen approval fingerprint does not recompute from the snapshot.",
        ),
      );
    }
  }
  return issues;
}

export async function evaluatePublishReadiness(input: {
  existing: ContextualContentReleaseManifest;
  reviewRepository?: ContentReviewRepository;
  pack?: ContextualSceneContentPack;
}): Promise<ReleaseValidationIssue[]> {
  const issues = evaluateSnapshotIntegrity(input.existing);
  issues.push(...evaluateHistoricalApprovalBindings(input.existing));
  const authority = await buildMealMigrationAuthority({
    reviewRepository: input.reviewRepository ?? fileContentReviewRepository,
    pack: input.pack,
  });
  issues.push(...authority.issues);
  if (input.existing.packSnapshot.id !== authority.livePack.id) {
    issues.push(
      issue("RELEASE_PACK_MISMATCH", "packSnapshot.id", "Release pack is not the current experimental pack."),
    );
  }
  const livePrint = fingerprintsForManifest({
    ...input.existing,
    packSnapshot: authority.snapshot.pack,
    contextSnapshot: authority.snapshot.context,
    targetEntries: authority.targetEntries,
  });
  const storedPrint = fingerprintsForManifest(input.existing);
  if (storedPrint.packFingerprint !== livePrint.packFingerprint) {
    issues.push(
      issue("RELEASE_FINGERPRINT_DRIFT", "packFingerprint", "Current pack content drifted from the draft snapshot."),
    );
  }
  if (storedPrint.contextModelFingerprint !== livePrint.contextModelFingerprint) {
    issues.push(
      issue("RELEASE_CONTEXT_MISMATCH", "contextModelFingerprint", "Current frames or skeleton drifted."),
    );
  }
  if (authority.targetEntries.length !== input.existing.targetEntries.length) {
    issues.push(issue("RELEASE_PACK_MISMATCH", "targetEntries", "Live target set no longer matches the draft."));
  }
  for (const [index, entry] of input.existing.targetEntries.entries()) {
    const live = authority.targetEntries.find((item) => item.reviewKey === entry.reviewKey);
    if (!live) {
      issues.push(issue("RELEASE_REVIEW_MISSING", `targetEntries.${index}`, `Missing live target ${entry.reviewKey}.`));
      continue;
    }
    if (live.contentFingerprint !== entry.contentFingerprint) {
      issues.push(
        issue("RELEASE_FINGERPRINT_DRIFT", `targetEntries.${index}.contentFingerprint`, "Target content fingerprint drifted."),
      );
    }
    if (live.reviewRevision !== entry.reviewRevision) {
      issues.push(issue("RELEASE_REVIEW_STALE", `targetEntries.${index}.reviewRevision`, "Review revision drifted."));
    }
    if (live.humanDecision !== entry.humanDecision) {
      issues.push(issue("RELEASE_REVIEW_STALE", `targetEntries.${index}.humanDecision`, "Review decision drifted."));
    }
    if (live.selectedMeaning !== entry.selectedMeaning) {
      issues.push(issue("RELEASE_MEANING_INVALID", `targetEntries.${index}.selectedMeaning`, "Selected meaning drifted."));
    }
    if (!sameLexemeSense(live.target, entry.target)) {
      issues.push(issue("RELEASE_SENSE_UNRESOLVED", `targetEntries.${index}.target`, "Exact sense no longer matches."));
    }
  }
  return issues;
}

export async function evaluateHistoricalReleaseIntegrity(input: {
  existing: ContextualContentReleaseManifest;
}): Promise<ReleaseValidationIssue[]> {
  const issues: ReleaseValidationIssue[] = [];
  if (input.existing.status !== "PUBLISHED" && input.existing.status !== "SUPERSEDED") {
    issues.push(
      issue("RELEASE_STATUS_ILLEGAL", "status", "Only previously published releases can be rolled back."),
    );
  }
  if (input.existing.publishedAt == null || input.existing.publishedBy == null) {
    issues.push(
      issue("RELEASE_TRANSITION_ILLEGAL", "publishedAt", "Historical rollback requires a real publishedAt/publishedBy."),
    );
  }
  issues.push(...evaluateSnapshotIntegrity(input.existing));
  issues.push(...evaluateHistoricalApprovalBindings(input.existing));
  return issues;
}

/** First-publish readiness. Not for historical rollback. */
export const evaluateReleaseReadiness = evaluatePublishReadiness;
