/**
 * Release approval-chain invariants. Candidate V0 / Experimental.
 * Pack identity is not approval. Same LexemeSenseRef is not content equality.
 */

import { fingerprintAuthoredPack, fingerprintContent } from "../content/content-fingerprint";
import { currentPackTargetFingerprint } from "../content/validate-experiment-promotion";
import type { ContextualSceneContentPack } from "../content/types";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import { sortedJson } from "./canonical-json";
import type { ReleaseValidationIssue, ReleaseValidationResult } from "./types";

export interface ApprovedReviewBinding {
  reviewKey: string;
  packId: string;
  target: LexemeSenseRef;
  contentFingerprint: string;
  decision: string;
  revision: number;
}

function issue(
  code: ReleaseValidationIssue["code"],
  path: string,
  detail: string,
): ReleaseValidationIssue {
  return { code, path, detail };
}

export function fingerprintTargetAgainstApprovalSource(input: {
  lexeme: ContextualSceneContentPack["lexemes"][number];
  approvalPackId: string;
  approvalSourceRefs: readonly string[];
}): string {
  return fingerprintContent({
    packId: input.approvalPackId,
    lexeme: input.lexeme,
    sourceRefs: input.approvalSourceRefs,
  });
}

function lexemeFor(
  pack: ContextualSceneContentPack,
  target: LexemeSenseRef,
): ContextualSceneContentPack["lexemes"][number] | null {
  const matches = pack.lexemes.filter((item) => sameLexemeSense(item.target, target));
  return matches.length === 1 ? matches[0]! : null;
}

function lexicalPresentationDrift(
  approved: ContextualSceneContentPack["lexemes"][number],
  current: ContextualSceneContentPack["lexemes"][number],
): boolean {
  return (
    approved.lexicalPresentation.displayLabel !== current.lexicalPresentation.displayLabel ||
    sortedJson(approved.lexicalPresentation) !== sortedJson(current.lexicalPresentation)
  );
}

export function resolveApprovedTargetFingerprint(input: {
  approvalPack: ContextualSceneContentPack;
  target: LexemeSenseRef;
}): string | null {
  return currentPackTargetFingerprint(input.approvalPack, input.target);
}

export function validateLegacyTargetAuthority(input: {
  reviewKey: string;
  lemma: string;
  baselinePack: ContextualSceneContentPack;
  baselinePackId: string;
  baselinePackFingerprint: string;
  currentPack: ContextualSceneContentPack;
  target: LexemeSenseRef;
  humanReviewKeys?: readonly string[];
}): ReleaseValidationResult & { approvedFingerprint?: string } {
  const issues: ReleaseValidationIssue[] = [];
  if (input.humanReviewKeys?.includes(input.reviewKey)) {
    issues.push(
      issue("RELEASE_LEGACY_FORGED", input.reviewKey, "Legacy attestation must not reuse a human review key."),
    );
    return { ok: false, issues };
  }
  if (input.baselinePack.id !== input.baselinePackId) {
    issues.push(issue("RELEASE_PACK_MISMATCH", input.reviewKey, "Legacy baseline pack id is not the grandfathered pack."));
  }
  if (fingerprintAuthoredPack(input.baselinePack) !== input.baselinePackFingerprint) {
    issues.push(
      issue("RELEASE_FINGERPRINT_DRIFT", input.reviewKey, "Legacy baseline pack fingerprint is not the grandfathered fingerprint."),
    );
  }
  const baselineLexeme = lexemeFor(input.baselinePack, input.target);
  const currentLexeme = lexemeFor(input.currentPack, input.target);
  if (!baselineLexeme || !currentLexeme) {
    issues.push(issue("RELEASE_SENSE_UNRESOLVED", input.reviewKey, `Legacy ${input.lemma} is missing from snapshot or baseline.`));
    return { ok: false, issues };
  }
  if (!sameLexemeSense(baselineLexeme.target, currentLexeme.target)) {
    issues.push(issue("RELEASE_SENSE_UNRESOLVED", input.reviewKey, `Legacy ${input.lemma} sense is not the baseline sense.`));
    return { ok: false, issues };
  }
  if (lexicalPresentationDrift(baselineLexeme, currentLexeme)) {
    issues.push(
      issue("RELEASE_FINGERPRINT_DRIFT", input.reviewKey, `Legacy ${input.lemma} lexical presentation drifted from the grandfathered baseline.`),
    );
  }
  const baselineFingerprint = fingerprintTargetAgainstApprovalSource({
    lexeme: baselineLexeme,
    approvalPackId: input.baselinePackId,
    approvalSourceRefs: input.baselinePack.provenance.sourceRefs,
  });
  const currentFingerprint = fingerprintTargetAgainstApprovalSource({
    lexeme: currentLexeme,
    approvalPackId: input.baselinePackId,
    approvalSourceRefs: input.baselinePack.provenance.sourceRefs,
  });
  if (baselineFingerprint !== currentFingerprint) {
    issues.push(
      issue(
        "RELEASE_FINGERPRINT_DRIFT",
        input.reviewKey,
        `Legacy ${input.lemma} content drifted from the grandfathered baseline. Same LexemeSenseRef is not approved content equality.`,
      ),
    );
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, issues, approvedFingerprint: baselineFingerprint };
}

export function validateHumanReviewedTargetAuthority(input: {
  reviewKey: string;
  expectedTarget: LexemeSenseRef;
  reviewPack: ContextualSceneContentPack;
  currentPack: ContextualSceneContentPack;
  reviewRecord: ApprovedReviewBinding | null;
}): ReleaseValidationResult & { approvedFingerprint?: string } {
  const issues: ReleaseValidationIssue[] = [];
  const record = input.reviewRecord;
  if (!record) {
    return {
      ok: false,
      issues: [issue("RELEASE_REVIEW_MISSING", input.reviewKey, "Current human review record is missing.")],
    };
  }
  if (record.reviewKey !== input.reviewKey) {
    issues.push(issue("RELEASE_REVIEW_INVALID", input.reviewKey, "Review key does not match the registered target."));
  }
  if (record.packId !== input.reviewPack.id) {
    issues.push(issue("RELEASE_REVIEW_INVALID", input.reviewKey, "Review record pack is not the expected review source."));
  }
  if (record.decision !== "APPROVED") {
    issues.push(issue("RELEASE_REVIEW_INVALID", input.reviewKey, "Human review is not APPROVED."));
  }
  if (!Number.isInteger(record.revision) || record.revision < 1) {
    issues.push(issue("RELEASE_REVIEW_INVALID", input.reviewKey, "Human review revision is not valid."));
  }
  if (!sameLexemeSense(record.target, input.expectedTarget)) {
    issues.push(issue("RELEASE_REVIEW_INVALID", input.reviewKey, "Review record target does not match the registered target."));
  }
  const reviewedLexeme = lexemeFor(input.reviewPack, input.expectedTarget);
  const currentLexeme = lexemeFor(input.currentPack, input.expectedTarget);
  if (!reviewedLexeme || !currentLexeme) {
    issues.push(issue("RELEASE_SENSE_UNRESOLVED", input.reviewKey, "Reviewed sense is missing from the reviewed or current pack."));
    return { ok: false, issues };
  }
  if (
    !sameLexemeSense(currentLexeme.target, input.expectedTarget) ||
    !sameLexemeSense(reviewedLexeme.target, input.expectedTarget)
  ) {
    issues.push(issue("RELEASE_REVIEW_INVALID", input.reviewKey, "Current snapshot target identity does not match the reviewed target."));
  }
  if (lexicalPresentationDrift(reviewedLexeme, currentLexeme)) {
    issues.push(
      issue("RELEASE_FINGERPRINT_DRIFT", input.reviewKey, "Current snapshot lexical presentation drifted from the approved review."),
    );
  }
  const reviewedPackTargetFingerprint = currentPackTargetFingerprint(input.reviewPack, input.expectedTarget);
  const currentReleaseSnapshotTargetFingerprint = fingerprintTargetAgainstApprovalSource({
    lexeme: currentLexeme,
    approvalPackId: input.reviewPack.id,
    approvalSourceRefs: input.reviewPack.provenance.sourceRefs,
  });
  if (
    !reviewedPackTargetFingerprint ||
    reviewedPackTargetFingerprint !== record.contentFingerprint ||
    currentReleaseSnapshotTargetFingerprint !== record.contentFingerprint ||
    reviewedPackTargetFingerprint !== currentReleaseSnapshotTargetFingerprint
  ) {
    issues.push(
      issue(
        "RELEASE_REVIEW_STALE",
        input.reviewKey,
        "Approved review fingerprint does not match both the reviewed pack and the current release snapshot. Inherited content cannot keep a stale APPROVED.",
      ),
    );
    issues.push(
      issue(
        "RELEASE_FINGERPRINT_DRIFT",
        input.reviewKey,
        "Current snapshot target content drifted from the historical approved fingerprint.",
      ),
    );
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, issues, approvedFingerprint: record.contentFingerprint };
}
