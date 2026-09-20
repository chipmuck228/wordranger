import "server-only";

import type { ExperienceRun } from "@/contextual-learning/candidate-v0/execution/types";

export const CONTEXT_LAB_RUN_SCHEMA_VERSION = "candidate-v0" as const;

export interface ContextLabRunRecord {
  id: string;
  userId: string;
  schemaVersion: typeof CONTEXT_LAB_RUN_SCHEMA_VERSION;
  experienceId: string;
  experienceRun: ExperienceRun;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type ContextLabSaveIfRevisionResult =
  | { ok: true; revision: number }
  | { ok: false; reason: "NOT_FOUND" | "REVISION_CONFLICT" };

export interface ContextLabRunRepository {
  create(record: ContextLabRunRecord): Promise<void>;

  get(input: {
    runId: string;
    userId: string;
  }): Promise<ContextLabRunRecord | null>;

  saveIfRevision(input: {
    runId: string;
    userId: string;
    expectedRevision: number;
    nextRun: ExperienceRun;
    updatedAt: string;
  }): Promise<ContextLabSaveIfRevisionResult>;
}
