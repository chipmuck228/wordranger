import { fingerprintsForManifest } from "./fingerprint";
import { parseReleaseManifest } from "./parse-manifest";
import { validateDraftRelease } from "./validate-draft-release";
import type {
  ContextualContentReleaseManifest,
  ContextualContentReleaseStatus,
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

function isSnapshotLocked(status: ContextualContentReleaseStatus): boolean {
  return (
    status === "PREFLIGHT_VALIDATED" ||
    status === "PUBLISHED" ||
    status === "SUPERSEDED"
  );
}

export function validateReleaseTransition(input: {
  current: ContextualContentReleaseManifest | unknown;
  next: ContextualContentReleaseManifest | unknown;
  requestedStatus?: ContextualContentReleaseStatus;
}): ReleaseValidationResult {
  const issues: ReleaseValidationIssue[] = [];
  const current = parseReleaseManifest(input.current);
  const next = parseReleaseManifest(input.next);
  if (!current || !next) {
    return {
      ok: false,
      issues: [issue("RELEASE_SCHEMA_INVALID", "manifest", "Release manifest schema is invalid.")],
    };
  }
  if (next.status === "ROLLED_BACK") {
    issues.push(
      issue(
        "RELEASE_TRANSITION_ILLEGAL",
        "status",
        "ROLLED_BACK is not a release status. Rollback only moves the active pointer.",
      ),
    );
  }
  if (current.releaseId !== next.releaseId || current.sceneId !== next.sceneId) {
    issues.push(issue("RELEASE_IMMUTABLE_MUTATION", "releaseId", "Release identity cannot change."));
  }
  const allowed =
    (current.status === "DRAFT" && next.status === "DRAFT") ||
    (current.status === "DRAFT" && next.status === "PREFLIGHT_VALIDATED") ||
    (current.status === "PREFLIGHT_VALIDATED" && next.status === "PREFLIGHT_VALIDATED") ||
    (current.status === "PREFLIGHT_VALIDATED" && next.status === "PUBLISHED") ||
    (current.status === "PUBLISHED" && next.status === "PUBLISHED") ||
    (current.status === "PUBLISHED" && next.status === "SUPERSEDED") ||
    (current.status === "SUPERSEDED" && next.status === "SUPERSEDED") ||
    (current.status === "SUPERSEDED" && next.status === "PUBLISHED");
  if (!allowed) {
    issues.push(
      issue(
        "RELEASE_TRANSITION_ILLEGAL",
        "status",
        `${current.status} → ${next.status} is not allowed.`,
      ),
    );
  }
  if (current.status === "DRAFT" && next.status === "PUBLISHED") {
    issues.push(
      issue(
        "RELEASE_TRANSITION_ILLEGAL",
        "status",
        "Only PREFLIGHT_VALIDATED releases can be published.",
      ),
    );
  }
  if (isSnapshotLocked(current.status)) {
    const currentPrint = fingerprintsForManifest(current);
    const nextPrint = fingerprintsForManifest(next);
    if (
      current.releaseFingerprint !== next.releaseFingerprint ||
      currentPrint.releaseFingerprint !== nextPrint.releaseFingerprint ||
      JSON.stringify(current.targetEntries) !== JSON.stringify(next.targetEntries) ||
      current.packFingerprint !== next.packFingerprint ||
      current.contextModelFingerprint !== next.contextModelFingerprint ||
      current.createdAt !== next.createdAt ||
      current.createdBy !== next.createdBy ||
      current.validatedAt !== next.validatedAt ||
      JSON.stringify(current.historicalApprovalBindings) !==
        JSON.stringify(next.historicalApprovalBindings)
    ) {
      issues.push(
        issue(
          "RELEASE_IMMUTABLE_MUTATION",
          "targetEntries",
          "A validated or published snapshot cannot rewrite content, fingerprints, or creation metadata.",
        ),
      );
    }
  }
  const draftCheck = validateDraftRelease(next);
  issues.push(...draftCheck.issues);
  return { ok: issues.length === 0, issues };
}
