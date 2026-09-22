import "server-only";

import { validateSceneContent } from "@/contextual-learning/candidate-v0/content";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { validateContextFrame } from "@/contextual-learning/candidate-v0/validation/validate-context-frame";
import { validateSemanticSkeleton } from "@/contextual-learning/candidate-v0/validation/validate-semantic-skeleton";
import {
  fingerprintsForManifest,
  validateDraftRelease,
  validateMealReleaseCapabilities,
  type ContextualContentReleaseManifest,
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

export async function evaluateReleaseReadiness(input: {
  existing: ContextualContentReleaseManifest;
  reviewRepository?: ContentReviewRepository;
  pack?: ContextualSceneContentPack;
}): Promise<ReleaseValidationIssue[]> {
  const issues: ReleaseValidationIssue[] = [];
  const draftCheck = validateDraftRelease(input.existing);
  issues.push(...draftCheck.issues);
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
  const skeletonCheck = validateSemanticSkeleton(input.existing.contextSnapshot.skeleton);
  if (!skeletonCheck.ok) {
    issues.push(issue("RELEASE_SKELETON_INVALID", "contextSnapshot.skeleton", "Skeleton validator failed."));
  }
  for (const frame of authoredFrames(input.existing)) {
    const frameCheck = validateContextFrame({
      frame,
      skeleton: input.existing.contextSnapshot.skeleton,
    });
    if (!frameCheck.ok) {
      issues.push(issue("RELEASE_FRAME_INVALID", frame.id, "Frame validator failed."));
    }
    const packCheck = validateSceneContent({
      pack: input.existing.packSnapshot,
      frame,
      frames: authoredFrames(input.existing),
      skeleton: input.existing.contextSnapshot.skeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    if (!packCheck.ok) {
      issues.push(issue("RELEASE_PACK_INVALID", frame.id, "Pack validator failed."));
    }
  }
  const capabilityCheck = validateMealReleaseCapabilities({
    targets: input.existing.targetEntries.map((entry) => entry.target),
  });
  issues.push(...capabilityCheck.issues);
  if (releaseContainsForbiddenLearnerData(input.existing)) {
    issues.push(issue("RELEASE_TRAIN_WIRED", "train", "/train or learner state must stay out of the release."));
  }
  try {
    JSON.parse(JSON.stringify(input.existing.packSnapshot));
    JSON.parse(JSON.stringify(input.existing.contextSnapshot));
  } catch {
    issues.push(issue("RELEASE_SNAPSHOT_UNSERIALIZABLE", "snapshot", "Release snapshot cannot be serialized."));
  }
  return issues;
}
