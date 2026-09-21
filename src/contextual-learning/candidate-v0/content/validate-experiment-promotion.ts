/**
 * Fail-closed Candidate V0 experiment promotion checks.
 * Does not read the filesystem or accept client input.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import { fingerprintContent } from "./content-fingerprint";
import { CANDIDATE_V0_EXPERIMENT_PROMOTION_KIND } from "./types";
import type {
  CandidateV0ExperimentPromotionAttestation,
  ContextualSceneContentPack,
  ContextualSceneContentRegistryEntry,
} from "./types";

export type ExperimentPromotionIssueCode =
  | "PROMOTION_ATTESTATION_MISSING"
  | "PROMOTION_PACK_MISMATCH"
  | "PROMOTION_TARGET_MISMATCH"
  | "PROMOTION_FINGERPRINT_MISMATCH"
  | "PROMOTION_REVIEW_INVALID"
  | "PROMOTION_REVIEW_STALE"
  | "PROMOTION_ARTIFACT_CONFLICT";

export interface ExperimentPromotionIssue {
  code: ExperimentPromotionIssueCode;
  path: string;
}

export interface CommittedHumanReviewRecord {
  schemaVersion?: string;
  reviewKey?: string;
  packId?: string;
  target?: { lexemeId?: string; senseId?: string };
  contentFingerprint?: string;
  decision?: string;
  revision?: number;
}

export interface CommittedPromotionArtifacts {
  reviewRecord: CommittedHumanReviewRecord | null;
  manifest?: {
    packId?: string;
    registryStatus?: string;
    contentFingerprint?: string;
    reviewStatus?: string;
    target?: { lexemeId?: string; senseId?: string };
  } | null;
  humanMarkdown?: string | null;
  packetMarkdown?: string | null;
}

export function currentPackTargetFingerprint(
  pack: ContextualSceneContentPack,
  target: { lexemeId: string; senseId: string },
): string | null {
  const matches = pack.lexemes.filter((lexeme) =>
    sameLexemeSense(lexeme.target, target),
  );
  if (matches.length !== 1) {
    return null;
  }
  return fingerprintContent({
    packId: pack.id,
    lexeme: matches[0]!,
    sourceRefs: pack.provenance.sourceRefs,
  });
}

export function attestationIsStructurallyBound(
  entry: ContextualSceneContentRegistryEntry,
): boolean {
  const attestation = entry.promotion;
  if (!attestation) {
    return false;
  }
  return (
    attestation.kind === CANDIDATE_V0_EXPERIMENT_PROMOTION_KIND &&
    attestation.schemaVersion === "candidate-v0" &&
    attestation.promotionScope === "EXPERIMENT_ONLY" &&
    attestation.approvalDecision === "APPROVED" &&
    attestation.packId === entry.packId &&
    attestation.packId === entry.pack.id &&
    Boolean(attestation.approvedContentFingerprint) &&
    Boolean(attestation.reviewKey) &&
    Boolean(attestation.reviewRecordSourcePath)
  );
}

export function validateExperimentPromotion(input: {
  entry: ContextualSceneContentRegistryEntry;
  expectedAttestation: CandidateV0ExperimentPromotionAttestation;
  artifacts: CommittedPromotionArtifacts;
}): { ok: true } | { ok: false; issues: ExperimentPromotionIssue[] } {
  const issues: ExperimentPromotionIssue[] = [];
  const { entry, expectedAttestation, artifacts } = input;
  if (entry.status !== "APPROVED_FOR_EXPERIMENT") {
    issues.push({ code: "PROMOTION_ATTESTATION_MISSING", path: "entry.status" });
  }
  if (!entry.promotion) {
    issues.push({ code: "PROMOTION_ATTESTATION_MISSING", path: "entry.promotion" });
    return { ok: false, issues };
  }
  if (!attestationIsStructurallyBound(entry)) {
    issues.push({ code: "PROMOTION_ATTESTATION_MISSING", path: "entry.promotion" });
  }
  if (
    entry.promotion.packId !== expectedAttestation.packId ||
    entry.packId !== expectedAttestation.packId ||
    entry.pack.id !== expectedAttestation.packId
  ) {
    issues.push({ code: "PROMOTION_PACK_MISMATCH", path: "packId" });
  }
  if (
    entry.promotion.reviewKey !== expectedAttestation.reviewKey ||
    artifacts.reviewRecord?.reviewKey !== expectedAttestation.reviewKey
  ) {
    issues.push({ code: "PROMOTION_PACK_MISMATCH", path: "reviewKey" });
  }
  if (
    !sameLexemeSense(entry.promotion.target, expectedAttestation.target) ||
    !artifacts.reviewRecord?.target ||
    !sameLexemeSense(artifacts.reviewRecord.target as { lexemeId: string; senseId: string }, expectedAttestation.target)
  ) {
    issues.push({ code: "PROMOTION_TARGET_MISMATCH", path: "target" });
  }
  const currentFingerprint = currentPackTargetFingerprint(
    entry.pack,
    expectedAttestation.target,
  );
  if (
    !currentFingerprint ||
    currentFingerprint !== expectedAttestation.approvedContentFingerprint ||
    entry.promotion.approvedContentFingerprint !== expectedAttestation.approvedContentFingerprint
  ) {
    issues.push({ code: "PROMOTION_FINGERPRINT_MISMATCH", path: "approvedContentFingerprint" });
  }
  const record = artifacts.reviewRecord;
  if (
    !record ||
    record.schemaVersion !== "candidate-v0" ||
    record.decision !== "APPROVED" ||
    record.revision !== expectedAttestation.approvedReviewRevision ||
    record.packId !== expectedAttestation.packId
  ) {
    issues.push({ code: "PROMOTION_REVIEW_INVALID", path: "reviewRecord" });
  }
  if (
    record?.contentFingerprint !== expectedAttestation.approvedContentFingerprint ||
    (currentFingerprint && record?.contentFingerprint !== currentFingerprint)
  ) {
    issues.push({ code: "PROMOTION_REVIEW_STALE", path: "reviewRecord.contentFingerprint" });
  }
  const manifest = artifacts.manifest;
  if (
    manifest &&
    (manifest.packId !== expectedAttestation.packId ||
      manifest.contentFingerprint !== expectedAttestation.approvedContentFingerprint ||
      manifest.reviewStatus !== "APPROVED" ||
      !manifest.target ||
      !sameLexemeSense(manifest.target as { lexemeId: string; senseId: string }, expectedAttestation.target))
  ) {
    issues.push({ code: "PROMOTION_ARTIFACT_CONFLICT", path: "manifest" });
  }
  const markdown = artifacts.humanMarkdown ?? "";
  if (
    markdown &&
    (!markdown.includes("Decision: APPROVED") ||
      !markdown.includes(expectedAttestation.approvedContentFingerprint))
  ) {
    issues.push({ code: "PROMOTION_ARTIFACT_CONFLICT", path: "HUMAN_REVIEW.md" });
  }
  const packetMarkdown = artifacts.packetMarkdown ?? "";
  if (
    packetMarkdown &&
    (!packetMarkdown.includes(expectedAttestation.approvedContentFingerprint) ||
      !packetMarkdown.includes("Human review: APPROVED") ||
      !packetMarkdown.includes(expectedAttestation.packId) ||
      !packetMarkdown.includes(expectedAttestation.target.senseId))
  ) {
    issues.push({ code: "PROMOTION_ARTIFACT_CONFLICT", path: "REVIEW_PACKET.md" });
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
