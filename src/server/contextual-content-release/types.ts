import type {
  ContextualContentReleaseManifest,
  ReleaseValidationIssue,
} from "@/contextual-learning/candidate-v0/release";

export const RELEASE_ACTOR_ID = "LOCAL_INTERNAL_RELEASER";

export type ReleaseSaveResult =
  | { ok: true; record: ContextualContentReleaseManifest; idempotent: boolean }
  | {
      ok: false;
      code:
        | "RELEASE_WRITE_DISABLED"
        | "RELEASE_CONFLICT"
        | "RELEASE_STALE"
        | "RELEASE_INVALID"
        | "RELEASE_NOT_FOUND"
        | "RELEASE_RUNTIME_INVALID";
      message: string;
    };

export type ReleasePreflightResult =
  | {
      ok: true;
      record: ContextualContentReleaseManifest;
      idempotent: boolean;
      issues: ReleaseValidationIssue[];
    }
  | {
      ok: false;
      code:
        | "RELEASE_WRITE_DISABLED"
        | "RELEASE_CONFLICT"
        | "RELEASE_STALE"
        | "RELEASE_INVALID"
        | "RELEASE_NOT_FOUND"
        | "RELEASE_RUNTIME_INVALID";
      message: string;
      issues: ReleaseValidationIssue[];
      record?: ContextualContentReleaseManifest;
    };

export interface ReleaseWorkspaceTarget {
  reviewKey: string;
  packId: string;
  displayLabel: string;
  senseId: string;
  lexemeId: string;
  reviewSource: "HUMAN_REVIEW" | "LEGACY_EXPERIMENT_BASELINE";
  contentFingerprint: string;
  reviewRevision: number;
  approvalBasis: string;
  selectedMeaning: string | null;
  humanDecision: string;
}

export interface ReleaseWorkspace {
  currentRuntime: {
    driver: "CODE_DEFINED_BATCH_02";
    packId: string;
    publishedByReleasePipeline: false;
    notice: string;
  };
  registry: Array<{
    packId: string;
    status: string;
    approvalBasis: string | null;
  }>;
  liveTargets: ReleaseWorkspaceTarget[];
  draft: ContextualContentReleaseManifest | null;
  writeEnabled: boolean;
  preflight: {
    ok: boolean | null;
    issues: ReleaseValidationIssue[];
  };
  fingerprints: {
    packFingerprint: string | null;
    contextModelFingerprint: string | null;
    releaseFingerprint: string | null;
  };
}
