import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { createInMemoryMatchingRuntime } from "./create-in-memory-matching-runtime";
import { createSupabaseMatchingRuntime } from "./create-supabase-matching-runtime";
import type { MatchingRuntime } from "./create-in-memory-matching-runtime";

let memoryRuntime: MatchingRuntime | null = null;

/**
 * Student-facing Matching composition root.
 * Uses the same explicit memory fixture flag as Ranger Trial.
 */
export function createMatchingRuntime(): MatchingRuntime {
  if (process.env.RANGER_TRIAL_RUNTIME === "memory") {
    memoryRuntime ??= createInMemoryMatchingRuntime({
      userId: V1_PLACEHOLDER_USER_ID,
      createId: () => crypto.randomUUID(),
      createSessionId: () => crypto.randomUUID(),
      createEvidenceId: () => crypto.randomUUID(),
    });
    return memoryRuntime;
  }
  return createSupabaseMatchingRuntime();
}
