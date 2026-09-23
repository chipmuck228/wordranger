import type {
  ContextualContentActiveReleasePointer,
  ContextualContentReleaseManifest,
} from "@/contextual-learning/candidate-v0/release";
import type { ReleaseFailureCode, ReleaseSaveResult } from "./types";


export type ActiveReleaseLoadResult =
  | {
      ok: true;
      pointer: ContextualContentActiveReleasePointer;
      release: ContextualContentReleaseManifest;
    }
  | {
      ok: false;
      code: "RELEASE_POINTER_INVALID" | "RELEASE_POINTER_MISMATCH" | "RELEASE_NOT_FOUND";
      message: string;
    };

export type PublishAtomicResult =
  | {
      ok: true;
      record: ContextualContentReleaseManifest;
      pointer: ContextualContentActiveReleasePointer;
      superseded: ContextualContentReleaseManifest | null;
      idempotent: boolean;
    }
  | {
      ok: false;
      code: ReleaseFailureCode;
      message: string;
    };

export type RollbackPointerResult =
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

export interface ContextualContentReleaseRepository {
  create(input: {
    record: ContextualContentReleaseManifest;
  }): Promise<ReleaseSaveResult>;
  get(releaseId: string): Promise<ContextualContentReleaseManifest | null>;
  list(): Promise<ContextualContentReleaseManifest[]>;
  listByScene(sceneId: string): Promise<ContextualContentReleaseManifest[]>;
  saveIfRevision(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult>;
  discard(input: {
    releaseId: string;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult>;
  getActivePointer(
    sceneId: string,
  ): Promise<ContextualContentActiveReleasePointer | null>;
  loadActiveRelease(sceneId: string): Promise<ActiveReleaseLoadResult>;
  publishAtomic(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
    pointer: ContextualContentActiveReleasePointer;
    expectedPointerRevision: number | null;
    superseded?: {
      record: ContextualContentReleaseManifest;
      expectedRevision: number;
    };
  }): Promise<PublishAtomicResult>;
  rollbackPointer(input: {
    sceneId: string;
    expectedPointerRevision: number;
    pointer: ContextualContentActiveReleasePointer;
  }): Promise<RollbackPointerResult>;
}
