import type {
  ContextualContentActiveReleasePointer,
  ContextualContentReleaseManifest,
  ReleaseValidationIssue,
} from "@/contextual-learning/candidate-v0/release";

export const RELEASE_ACTOR_ID = "LOCAL_INTERNAL_RELEASER";

export type ReleaseFailureCode =
  | "RELEASE_WRITE_DISABLED"
  | "RELEASE_CONFLICT"
  | "RELEASE_STALE"
  | "RELEASE_INVALID"
  | "RELEASE_NOT_FOUND"
  | "RELEASE_RUNTIME_INVALID"
  | "RELEASE_NOT_PUBLISHED"
  | "RELEASE_POINTER_INVALID"
  | "RELEASE_POINTER_MISMATCH";

export type ReleaseSaveResult =
  | { ok: true; record: ContextualContentReleaseManifest; idempotent: boolean }
  | {
      ok: false;
      code: ReleaseFailureCode;
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
      code: ReleaseFailureCode;
      message: string;
      issues: ReleaseValidationIssue[];
      record?: ContextualContentReleaseManifest;
    };

export type ReleasePublishResult =
  | {
      ok: true;
      record: ContextualContentReleaseManifest;
      pointer: ContextualContentActiveReleasePointer;
      superseded: ContextualContentReleaseManifest | null;
      idempotent: boolean;
      issues: ReleaseValidationIssue[];
    }
  | {
      ok: false;
      code: ReleaseFailureCode;
      message: string;
      issues: ReleaseValidationIssue[];
      record?: ContextualContentReleaseManifest;
    };

export type ReleaseRollbackResult =
  | {
      ok: true;
      pointer: ContextualContentActiveReleasePointer;
      target: ContextualContentReleaseManifest;
      idempotent: boolean;
    }
  | {
      ok: false;
      code: ReleaseFailureCode;
      message: string;
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

export interface ReleaseWorkspaceCard {
  releaseId: string;
  sceneId: string;
  status: ContextualContentReleaseManifest["status"];
  revision: number;
  packFingerprint: string;
  releaseFingerprint: string;
  targetCount: number;
  approvalSummary: string;
  preflightOk: boolean | null;
  isActive: boolean;
  publishedAt: string | null;
  supersededAt: string | null;
  supersededByReleaseId: string | null;
}

export interface ReleaseWorkspace {
  currentRuntime: {
    driver: "CODE_DEFINED_BATCH_02" | "ACTIVE_RELEASE";
    packId: string | null;
    publishedByReleasePipeline: boolean;
    contentSource: "static" | "active-release";
    notice: string;
  };
  registry: Array<{
    packId: string;
    status: string;
    approvalBasis: string | null;
  }>;
  liveTargets: ReleaseWorkspaceTarget[];
  draft: ContextualContentReleaseManifest | null;
  releases: ReleaseWorkspaceCard[];
  activePointer: ContextualContentActiveReleasePointer | null;
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
