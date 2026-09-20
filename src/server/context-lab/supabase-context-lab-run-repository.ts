import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { isAbortLike } from "@/lib/runtime/persistence-timeout";
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

interface ContextLabRunRow {
  id: string;
  user_id: string;
  schema_version: string;
  experience_id: string;
  run_state: unknown;
  revision: number;
  created_at: string;
  updated_at: string;
}

export class SupabaseContextLabRunRepository implements ContextLabRunRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly expectedUserId: string,
  ) {}

  async create(record: ContextLabRunRecord): Promise<void> {
    if (record.revision !== 0) {
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.PLAN_VALIDATION_FAILURE,
        "New Context Lab runs must start at revision 0",
        false,
      );
    }
    if (record.userId !== this.expectedUserId) {
      throw new ContextLabError(
        CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_NOT_FOUND,
        "Context Lab run does not belong to the current user",
        true,
      );
    }
    const runState = serializeContextLabRunState({
      experienceRun: record.experienceRun,
      probe: record.probe ?? null,
    });
    const { error } = await this.client.from("context_lab_runs").insert({
      id: record.id,
      user_id: record.userId,
      schema_version: CONTEXT_LAB_RUN_SCHEMA_VERSION,
      experience_id: record.experienceId,
      run_state: runState,
      revision: 0,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    });
    if (error) {
      if (error.code === "23505") {
        throw new ContextLabError(
          CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
          "Context Lab run id already exists",
          true,
        );
      }
      persistError(error);
    }
  }

  async get(input: {
    runId: string;
    userId: string;
  }): Promise<ContextLabRunRecord | null> {
    if (input.userId !== this.expectedUserId) {
      return null;
    }
    const { data, error } = await this.client
      .from("context_lab_runs")
      .select(
        "id, user_id, schema_version, experience_id, run_state, revision, created_at, updated_at",
      )
      .eq("id", input.runId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (error) {
      persistError(error);
    }
    if (!data) {
      return null;
    }
    const row = data as ContextLabRunRow;
    return parseContextLabRunRecord({
      id: row.id,
      userId: row.user_id,
      expectedUserId: input.userId,
      schemaVersion: row.schema_version,
      experienceId: row.experience_id,
      runState: row.run_state,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async saveIfRevision(input: {
    runId: string;
    userId: string;
    expectedRevision: number;
    nextRun: ContextLabRunRecord["experienceRun"];
    nextProbe?: ContextLabRunRecord["probe"];
    updatedAt: string;
  }): Promise<ContextLabSaveIfRevisionResult> {
    if (input.userId !== this.expectedUserId) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    let probe = input.nextProbe;
    if (probe === undefined) {
      const existing = await this.get({
        runId: input.runId,
        userId: input.userId,
      });
      if (!existing) {
        return { ok: false, reason: "NOT_FOUND" };
      }
      if (existing.revision !== input.expectedRevision) {
        return { ok: false, reason: "REVISION_CONFLICT" };
      }
      probe = existing.probe;
    }
    const runState = serializeContextLabRunState({
      experienceRun: input.nextRun,
      probe: probe ?? null,
    });
    const { data, error } = await this.client
      .from("context_lab_runs")
      .update({
        run_state: runState,
        updated_at: input.updatedAt,
        revision: input.expectedRevision + 1,
      })
      .eq("id", input.runId)
      .eq("user_id", input.userId)
      .eq("revision", input.expectedRevision)
      .select("revision")
      .maybeSingle();
    if (error) {
      persistError(error);
    }
    if (data) {
      return { ok: true, revision: data.revision as number };
    }
    const existing = await this.get({
      runId: input.runId,
      userId: input.userId,
    });
    if (!existing) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    return { ok: false, reason: "REVISION_CONFLICT" };
  }
}

function persistError(error: unknown): never {
  if (isAbortLike(error)) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.NETWORK_ERROR,
      "Could not persist the Context Lab run",
      true,
    );
  }
  throw new ContextLabError(
    CONTEXT_LAB_ERROR_CODES.NETWORK_ERROR,
    "Could not persist the Context Lab run",
    true,
  );
}
