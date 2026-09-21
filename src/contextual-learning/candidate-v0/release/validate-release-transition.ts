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
  if (input.requestedStatus === "PUBLISHED" || next.status === "PUBLISHED") {
    issues.push(
      issue(
        "RELEASE_TRANSITION_ILLEGAL",
        "status",
        "Phase 1 cannot publish. DRAFT → PUBLISHED is rejected.",
      ),
    );
  }
  if (next.status === "SUPERSEDED" || next.status === "ROLLED_BACK") {
    issues.push(
      issue("RELEASE_TRANSITION_ILLEGAL", "status", "Phase 1 cannot supersede or roll back."),
    );
  }
  if (current.releaseId !== next.releaseId || current.sceneId !== next.sceneId) {
    issues.push(issue("RELEASE_IMMUTABLE_MUTATION", "releaseId", "Release identity cannot change."));
  }
  const allowed =
    (current.status === "DRAFT" && next.status === "DRAFT") ||
    (current.status === "DRAFT" && next.status === "PREFLIGHT_VALIDATED") ||
    (current.status === "PREFLIGHT_VALIDATED" && next.status === "PREFLIGHT_VALIDATED");
  if (!allowed) {
    issues.push(
      issue(
        "RELEASE_TRANSITION_ILLEGAL",
        "status",
        `${current.status} → ${next.status} is not allowed in Phase 1.`,
      ),
    );
  }
  if (current.status === "PREFLIGHT_VALIDATED") {
    const currentPrint = fingerprintsForManifest(current);
    const nextPrint = fingerprintsForManifest(next);
    if (
      current.releaseFingerprint !== next.releaseFingerprint ||
      currentPrint.releaseFingerprint !== nextPrint.releaseFingerprint ||
      JSON.stringify(current.targetEntries) !== JSON.stringify(next.targetEntries) ||
      current.packFingerprint !== next.packFingerprint ||
      current.contextModelFingerprint !== next.contextModelFingerprint
    ) {
      issues.push(
        issue(
          "RELEASE_IMMUTABLE_MUTATION",
          "targetEntries",
          "A PREFLIGHT_VALIDATED manifest cannot be rewritten.",
        ),
      );
    }
  }
  const draftCheck = validateDraftRelease(next);
  issues.push(...draftCheck.issues);
  return { ok: issues.length === 0, issues };
}
