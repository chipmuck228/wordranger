import type { ContextualContentReleaseManifest } from "@/contextual-learning/candidate-v0/release";
import type { ReleaseSaveResult } from "./types";

export interface ContextualContentReleaseRepository {
  create(input: {
    record: ContextualContentReleaseManifest;
  }): Promise<ReleaseSaveResult>;
  get(releaseId: string): Promise<ContextualContentReleaseManifest | null>;
  list(): Promise<ContextualContentReleaseManifest[]>;
  saveIfRevision(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult>;
  discard(input: {
    releaseId: string;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult>;
}
