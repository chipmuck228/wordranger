import "server-only";

import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { ContextLabError } from "./context-lab-errors";
import {
  parseContextLabRunRecord,
  serializeContextLabRunState,
} from "./context-lab-run-state";
import {
  CONTEXT_LAB_RUN_SCHEMA_VERSION,
  type ContextLabRunRecord,
  type ContextLabRunRepository,
  type ContextLabSaveIfRevisionResult,
} from "./context-lab-run.types";

export type InMemoryContextLabRunMap = Map<string, ContextLabRunRecord>;

/**
 * Isolated in-memory adapter. Tests must construct their own instance.
 * The memory runtime composition root may keep one process-local instance
 * for local/e2e request sharing; that is never the production repository.
 */
export class InMemoryContextLabRunRepository implements ContextLabRunRepository {
  constructor(private readonly rows: InMemoryContextLabRunMap = new Map()) {}

  async create(record: ContextLabRunRecord): Promise<void> {
    if (record.revision !== 0) {
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
        "New Context Lab runs must start at revision 0",
        false,
      );
    }
    if (this.rows.has(record.id)) {
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
        "Context Lab run id already exists",
        true,
      );
    }
    const stored = cloneRecord({
      ...record,
      probe: record.probe ?? null,
    });
    serializeContextLabRunState({
      experienceRun: stored.experienceRun,
      probe: stored.probe,
    });
    this.rows.set(record.id, stored);
  }

  async get(input: {
    runId: string;
    userId: string;
  }): Promise<ContextLabRunRecord | null> {
    const stored = this.rows.get(input.runId);
    if (!stored || stored.userId !== input.userId) {
      return null;
    }
    return parseContextLabRunRecord({
      id: stored.id,
      userId: stored.userId,
      expectedUserId: input.userId,
      schemaVersion: stored.schemaVersion,
      experienceId: stored.experienceId,
      runState: serializeContextLabRunState({
        experienceRun: stored.experienceRun,
        probe: stored.probe ?? null,
      }),
      revision: stored.revision,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    });
  }

  async saveIfRevision(input: {
    runId: string;
    userId: string;
    expectedRevision: number;
    nextRun: ExperienceRunLike;
    nextProbe?: ContextLabRunRecord["probe"];
    updatedAt: string;
  }): Promise<ContextLabSaveIfRevisionResult> {
    const stored = this.rows.get(input.runId);
    if (!stored || stored.userId !== input.userId) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (stored.revision !== input.expectedRevision) {
      return { ok: false, reason: "REVISION_CONFLICT" };
    }
    if (input.nextRun.id !== stored.id || input.nextRun.experienceId !== stored.experienceId) {
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
        "Updated Context Lab run identity does not match the stored row",
        false,
      );
    }
    const next: ContextLabRunRecord = {
      ...stored,
      experienceRun: input.nextRun,
      probe: input.nextProbe !== undefined ? input.nextProbe : stored.probe ?? null,
      revision: input.expectedRevision + 1,
      updatedAt: input.updatedAt,
      schemaVersion: CONTEXT_LAB_RUN_SCHEMA_VERSION,
    };
    parseContextLabRunRecord({
      id: next.id,
      userId: next.userId,
      expectedUserId: input.userId,
      schemaVersion: next.schemaVersion,
      experienceId: next.experienceId,
      runState: serializeContextLabRunState({
        experienceRun: next.experienceRun,
        probe: next.probe,
      }),
      revision: next.revision,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    });
    this.rows.set(input.runId, cloneRecord(next));
    return { ok: true, revision: next.revision };
  }

  reset(): void {
    this.rows.clear();
  }

  /** Test-only: write a raw row without serialization checks. */
  replaceRaw(record: ContextLabRunRecord): void {
    this.rows.set(record.id, record);
  }
}

type ExperienceRunLike = ContextLabRunRecord["experienceRun"];

function cloneRecord(record: ContextLabRunRecord): ContextLabRunRecord {
  return structuredClone(record);
}
