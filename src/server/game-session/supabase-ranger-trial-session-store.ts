import type { SupabaseClient } from "@supabase/supabase-js";
import { RANGER_TRIAL_GAME_TYPE } from "@/server/auth/v1-user";
import { SupabaseGameSessionStore } from "./supabase-game-session-store";

export class SupabaseRangerTrialSessionStore extends SupabaseGameSessionStore {
  constructor(client: SupabaseClient, expectedUserId?: string) {
    super(client, {
      expectedUserId,
      expectedGameType: RANGER_TRIAL_GAME_TYPE,
    });
  }
}
