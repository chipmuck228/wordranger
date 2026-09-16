import type { SupabaseClient } from "@supabase/supabase-js";
import { RANGER_TRIAL_GAME_TYPE } from "@/server/auth/v1-user";
import { GameSessionError } from "./ranger-trial-errors";
import {
  assertNoAnswerKeyFields,
  parseRangerTrialSessionRecord,
  serializeRangerTrialState,
  sessionStatusFromPhase,
} from "./ranger-trial-session-state";
import type {
  RangerTrialSessionRecord,
  RangerTrialSessionStore,
} from "./ranger-trial-session.types";

interface GameSessionRow {
  id: string;
  user_id: string;
  game_type: string;
  plan_id: string;
  status: string;
  state: unknown;
  created_at: string;
  updated_at: string;
  revision: number;
}

function persistError(): never {
  throw new GameSessionError(
    "NETWORK_ERROR",
    "Could not persist the game session",
  );
}

function conflict(): never {
  throw new GameSessionError(
    "SESSION_CONFLICT",
    "Session was updated by another request",
  );
}

export class SupabaseRangerTrialSessionStore
  implements RangerTrialSessionStore
{
  constructor(
    private readonly client: SupabaseClient,
    private readonly expectedUserId?: string,
  ) {}

  async create(
    record: RangerTrialSessionRecord,
  ): Promise<RangerTrialSessionRecord> {
    if (record.revision !== 0) {
      throw new GameSessionError(
        "SESSION_START_FAILED",
        "New sessions must start at revision 0",
      );
    }
    const state = serializeRangerTrialState(record);
    assertNoAnswerKeyFields(state);
    const { error } = await this.client.from("game_sessions").insert({
      id: record.sessionId,
      user_id: record.userId,
      game_type: RANGER_TRIAL_GAME_TYPE,
      plan_id: record.planId,
      status: sessionStatusFromPhase(record.phase),
      state,
      created_at: record.createdAt,
      updated_at: record.createdAt,
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

  async save(
    record: RangerTrialSessionRecord,
  ): Promise<RangerTrialSessionRecord> {
    const state = serializeRangerTrialState(record);
    assertNoAnswerKeyFields(state);
    const expected = record.revision;
    const next = expected + 1;
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("game_sessions")
      .update({
        plan_id: record.planId,
        status: sessionStatusFromPhase(record.phase),
        state,
        updated_at: now,
        revision: next,
      })
      .eq("id", record.sessionId)
      .eq("user_id", record.userId)
      .eq("game_type", RANGER_TRIAL_GAME_TYPE)
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

  async get(sessionId: string): Promise<RangerTrialSessionRecord | null> {
    const { data, error } = await this.client
      .from("game_sessions")
      .select(
        "id, user_id, game_type, plan_id, status, state, created_at, revision",
      )
      .eq("id", sessionId)
      .maybeSingle();
    if (error) {
      persistError();
    }
    if (!data) {
      return null;
    }
    const row = data as GameSessionRow;
    return parseRangerTrialSessionRecord({
      sessionId: row.id,
      userId: row.user_id,
      gameType: row.game_type,
      expectedUserId: this.expectedUserId,
      state: row.state,
      revision: row.revision,
    });
  }
}
