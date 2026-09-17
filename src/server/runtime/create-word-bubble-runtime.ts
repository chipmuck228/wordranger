import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { isMemoryGameRuntime } from "@/lib/runtime/game-runtime-mode";
import { createInMemoryWordBubbleRuntime } from "./create-in-memory-word-bubble-runtime";
import { createSupabaseWordBubbleRuntime } from "./create-supabase-word-bubble-runtime";
import type { WordBubbleRuntime } from "./create-in-memory-word-bubble-runtime";

let memoryRuntime: WordBubbleRuntime | null = null;

/**
 * Student-facing Word Bubble composition root.
 * Uses the same explicit memory fixture flag as Ranger Trial
 * (`RANGER_TRIAL_RUNTIME=memory` or `GAME_RUNTIME=memory`).
 */
export function createWordBubbleRuntime(): WordBubbleRuntime {
  if (isMemoryGameRuntime()) {
    memoryRuntime ??= createInMemoryWordBubbleRuntime({
      userId: V1_PLACEHOLDER_USER_ID,
      createId: () => crypto.randomUUID(),
      createSessionId: () => crypto.randomUUID(),
      createEvidenceId: () => crypto.randomUUID(),
    });
    return memoryRuntime;
  }
  return createSupabaseWordBubbleRuntime();
}
