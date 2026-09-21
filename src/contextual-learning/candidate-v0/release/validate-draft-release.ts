import { lexemeSenseKey, sameLexemeSense } from "../domain/lexeme-sense";
import { fingerprintsForManifest } from "./fingerprint";
import { parseReleaseManifest } from "./parse-manifest";
import { serializeReleaseValue } from "./canonical-json";
import type {
  ContextualContentReleaseManifest,
  ReleaseTargetEntry,
  ReleaseValidationIssue,
  ReleaseValidationResult,
} from "./types";

function issue(
  code: ReleaseValidationIssue["code"],
  path: string,
  detail: string,
): ReleaseValidationIssue {
  return { code, path, detail };
}

export function validateDraftRelease(
  input: ContextualContentReleaseManifest | unknown,
): ReleaseValidationResult {
  const issues: ReleaseValidationIssue[] = [];
  const manifest = parseReleaseManifest(input);
  if (!manifest) {
    return {
      ok: false,
      issues: [issue("RELEASE_SCHEMA_INVALID", "manifest", "Release manifest schema is invalid.")],
    };
  }
  if (manifest.status !== "DRAFT" && manifest.status !== "PREFLIGHT_VALIDATED") {
    issues.push(
      issue(
        "RELEASE_STATUS_ILLEGAL",
        "status",
        "Phase 1 only allows DRAFT or PREFLIGHT_VALIDATED.",
      ),
    );
  }
  const seenKeys = new Set<string>();
  const seenSenses = new Set<string>();
  for (const [index, entry] of manifest.targetEntries.entries()) {
    const keyPath = `targetEntries.${index}`;
    if (seenKeys.has(entry.reviewKey)) {
      issues.push(issue("RELEASE_DUPLICATE_TARGET", `${keyPath}.reviewKey`, entry.reviewKey));
    }
    seenKeys.add(entry.reviewKey);
    const senseKey = lexemeSenseKey(entry.target);
    if (seenSenses.has(senseKey)) {
      issues.push(issue("RELEASE_DUPLICATE_SENSE", `${keyPath}.target`, senseKey));
    }
    seenSenses.add(senseKey);
    const matches = manifest.packSnapshot.lexemes.filter((lexeme) =>
      sameLexemeSense(lexeme.target, entry.target),
    );
    if (matches.length !== 1) {
      issues.push(
        issue("RELEASE_SENSE_UNRESOLVED", `${keyPath}.target`, "Exact sense is not unique in the snapshot pack."),
      );
    }
    if (entry.approvalBasis === "LEGACY_EXPERIMENT_BASELINE") {
      if (entry.humanDecision !== "LEGACY_BASELINE") {
        issues.push(
          issue("RELEASE_LEGACY_FORGED", `${keyPath}.humanDecision`, "Legacy targets cannot claim APPROVED."),
        );
      }
      if (entry.reviewRevision !== 0) {
        issues.push(
          issue("RELEASE_LEGACY_FORGED", `${keyPath}.reviewRevision`, "Legacy attestation has no human revision."),
        );
      }
    }
    if (entry.approvalBasis === "HUMAN_REVIEW_PROMOTION") {
      if (entry.humanDecision !== "APPROVED") {
        issues.push(
          issue("RELEASE_REVIEW_INVALID", `${keyPath}.humanDecision`, "Human-reviewed targets must be APPROVED."),
        );
      }
      if (entry.reviewRevision < 1) {
        issues.push(
          issue("RELEASE_REVIEW_INVALID", `${keyPath}.reviewRevision`, "Human review revision is missing."),
        );
      }
    }
  }
  const ordered = [...manifest.targetEntries].sort((left, right) => {
    const leftOrder = sceneOrder(manifest, left.target);
    const rightOrder = sceneOrder(manifest, right.target);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.target.senseId.localeCompare(right.target.senseId);
  });
  const orderMatches = ordered.every(
    (entry, index) =>
      entry.reviewKey === manifest.targetEntries[index]?.reviewKey &&
      sameLexemeSense(entry.target, manifest.targetEntries[index]!.target),
  );
  if (!orderMatches) {
    issues.push(
      issue("RELEASE_TARGET_ORDER", "targetEntries", "Target order must be deterministic by sceneOrder then senseId."),
    );
  }
  try {
    JSON.parse(serializeReleaseValue(manifest.packSnapshot));
    JSON.parse(serializeReleaseValue(manifest.contextSnapshot));
  } catch {
    issues.push(
      issue("RELEASE_SNAPSHOT_UNSERIALIZABLE", "packSnapshot", "Release snapshot cannot be serialized."),
    );
  }
  const computed = fingerprintsForManifest(manifest);
  if (computed.packFingerprint !== manifest.packFingerprint) {
    issues.push(issue("RELEASE_FINGERPRINT_DRIFT", "packFingerprint", "Authored pack fingerprint drifted."));
  }
  if (computed.contextModelFingerprint !== manifest.contextModelFingerprint) {
    issues.push(
      issue("RELEASE_CONTEXT_MISMATCH", "contextModelFingerprint", "Context model fingerprint drifted."),
    );
  }
  if (computed.releaseFingerprint !== manifest.releaseFingerprint) {
    issues.push(issue("RELEASE_FINGERPRINT_DRIFT", "releaseFingerprint", "Release fingerprint drifted."));
  }
  if (computed.releaseFingerprint !== fingerprintsForManifest(manifest).releaseFingerprint) {
    issues.push(
      issue("RELEASE_FINGERPRINT_DRIFT", "releaseFingerprint", "Release fingerprint is not repeatable."),
    );
  }
  return { ok: issues.length === 0, issues };
}

function sceneOrder(
  manifest: ContextualContentReleaseManifest,
  target: ReleaseTargetEntry["target"],
): number {
  const lexeme = manifest.packSnapshot.lexemes.find((item) => sameLexemeSense(item.target, target));
  return lexeme?.membership.frameBindings[0]?.sceneOrder ?? Number.MAX_SAFE_INTEGER;
}
