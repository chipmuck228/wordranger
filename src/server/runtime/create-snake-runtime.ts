import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { createInMemorySnakeRuntime } from "./create-in-memory-snake-runtime";
import { createSupabaseSnakeRuntime } from "./create-supabase-snake-runtime";
import type { SnakeRuntime } from "./create-in-memory-snake-runtime";

let memoryRuntime: SnakeRuntime | null = null;

/**
 * Student-facing Snake composition root.
 * Uses the same explicit memory fixture flag as Ranger Trial.
 */
export function createSnakeRuntime(): SnakeRuntime {
  if (process.env.RANGER_TRIAL_RUNTIME === "memory") {
    memoryRuntime ??= createInMemorySnakeRuntime({
      userId: V1_PLACEHOLDER_USER_ID,
      createId: () => crypto.randomUUID(),
      createSessionId: () => crypto.randomUUID(),
      createEvidenceId: () => crypto.randomUUID(),
    });
    return memoryRuntime;
  }
  return createSupabaseSnakeRuntime();
}
