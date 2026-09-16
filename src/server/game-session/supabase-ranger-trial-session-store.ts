import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RANGER_TRIAL_GAME_TYPE,
} from "@/server/auth/v1-user";
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
}

function persistError(): never {
  throw new GameSessionError(
    "NETWORK_ERROR",
    "Could not persist the game session",
  );
}

export class SupabaseRangerTrialSessionStore
  implements RangerTrialSessionStore
{
  constructor(
    private readonly client: SupabaseClient,
    private readonly expectedUserId?: string,
  ) {}

  async save(record: RangerTrialSessionRecord): Promise<void> {
    const state = serializeRangerTrialState(record);
    assertNoAnswerKeyFields(state);
    const now = new Date().toISOString();
    const { error } = await this.client.from("game_sessions").upsert(
      {
        id: record.sessionId,
        user_id: record.userId,
        game_type: RANGER_TRIAL_GAME_TYPE,
        plan_id: record.planId,
        status: sessionStatusFromPhase(record.phase),
        state,
        created_at: record.createdAt,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (error) {
      persistError();
    }
  }

  async get(sessionId: string): Promise<RangerTrialSessionRecord | null> {
    const { data, error } = await this.client
      .from("game_sessions")
      .select("id, user_id, game_type, plan_id, status, state, created_at")
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
    });
  }
}
