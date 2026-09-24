import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { FREE_PRACTICE_ORCHESTRATION_TYPE } from "./constants";
import { FreePracticeSessionError } from "./errors";
import { parseFreePracticeRecord, serializeFreePracticeState } from "./state";
import type {
  FreePracticeSessionRecord,
  FreePracticeSessionStore,
} from "./types";

interface GameSessionRow {
  id: string;
  user_id: string;
  game_type: string;
  plan_id: string;
  status: string;
  state: unknown;
  created_at: string;
  revision: number;
}

function persistError(): never {
  throw new FreePracticeSessionError(
    "NETWORK_ERROR",
    "Could not persist the Free Practice session",
  );
}

function conflict(): never {
  throw new FreePracticeSessionError(
    "SESSION_CONFLICT",
    "Session was updated by another request",
  );
}

/**
 * Dedicated Free Practice session adapter. Always binds the trusted
 * userId on read and CAS write. Service role is not a license to omit
 * the user filter.
 */
export class SupabaseFreePracticeSessionStore
  implements FreePracticeSessionStore
{
  constructor(private readonly client: SupabaseClient) {}

  async create(
    record: FreePracticeSessionRecord,
  ): Promise<FreePracticeSessionRecord> {
    if (record.revision !== 0) {
      throw new FreePracticeSessionError(
        "SESSION_START_FAILED",
        "New sessions must start at revision 0",
      );
    }
    const state = serializeFreePracticeState(record);
    const { error } = await this.client.from("game_sessions").insert({
      id: record.sessionId,
      user_id: record.userId,
      game_type: FREE_PRACTICE_ORCHESTRATION_TYPE,
      plan_id: record.planId,
      status: "active",
      state,
      created_at: record.state.createdAt,
      updated_at: record.state.createdAt,
      revision: 0,
    });
    if (error) {
      if (error.code === "23505") {
        conflict();
      }
      persistError();
    }
    return { ...record, revision: 0 };
  }

  async get(
    sessionId: string,
    userId: string,
  ): Promise<FreePracticeSessionRecord | null> {
    const { data, error } = await this.client
      .from("game_sessions")
      .select(
        "id, user_id, game_type, plan_id, status, state, created_at, revision",
      )
      .eq("id", sessionId)
      .eq("user_id", userId)
      .eq("game_type", FREE_PRACTICE_ORCHESTRATION_TYPE)
      .maybeSingle();
    if (error) {
      persistError();
    }
    if (!data) {
      return null;
    }
    const row = data as GameSessionRow;
    return parseFreePracticeRecord({
      sessionId: row.id,
      userId: row.user_id,
      gameType: row.game_type,
      expectedGameType: FREE_PRACTICE_ORCHESTRATION_TYPE,
      expectedUserId: userId,
      planId: row.plan_id,
      state: row.state,
      revision: row.revision,
    });
  }

  async save(
    record: FreePracticeSessionRecord,
  ): Promise<FreePracticeSessionRecord> {
    const state = serializeFreePracticeState(record);
    const expected = record.revision;
    const next = expected + 1;
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("game_sessions")
      .update({
        plan_id: record.planId,
        status: "active",
        state,
        updated_at: now,
        revision: next,
      })
      .eq("id", record.sessionId)
      .eq("user_id", record.userId)
      .eq("game_type", FREE_PRACTICE_ORCHESTRATION_TYPE)
      .eq("revision", expected)
      .select("revision")
      .maybeSingle();
    if (error) {
      persistError();
    }
    if (!data) {
      conflict();
    }
    return { ...record, revision: data.revision as number };
  }
}
