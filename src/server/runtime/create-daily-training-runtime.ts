import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { isMemoryGameRuntime } from "@/lib/runtime/game-runtime-mode";
import { createInMemoryDailyTrainingRuntime } from "./create-in-memory-daily-training-runtime";
import { createSupabaseDailyTrainingRuntime } from "./create-supabase-daily-training-runtime";
import type { DailyTrainingRuntime } from "./create-in-memory-daily-training-runtime";

let memoryRuntime: DailyTrainingRuntime | null = null;

/**
 * Daily Training composition root.
 * Uses the shared memory fixture (`RANGER_TRIAL_RUNTIME=memory` or
 * `GAME_RUNTIME=memory`). Production stays on durable Supabase.
 */
export function createDailyTrainingRuntime(): DailyTrainingRuntime {
  if (isMemoryGameRuntime()) {
    memoryRuntime ??= createInMemoryDailyTrainingRuntime({
      userId: V1_PLACEHOLDER_USER_ID,
      createId: () => crypto.randomUUID(),
      createSessionId: () => crypto.randomUUID(),
      createEvidenceId: () => crypto.randomUUID(),
    });
    return memoryRuntime;
  }
  return createSupabaseDailyTrainingRuntime();
}
