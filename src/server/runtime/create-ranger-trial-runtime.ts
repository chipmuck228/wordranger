import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { createInMemoryRangerTrialRuntime } from "./create-in-memory-ranger-trial-runtime";
import { createSupabaseRangerTrialRuntime } from "./create-supabase-ranger-trial-runtime";
import type { RangerTrialRuntime } from "./ranger-trial-runtime";

let memoryRuntime: RangerTrialRuntime | null = null;

/**
 * Student-facing composition root.
 *
 * Production (default): durable Supabase adapters. Missing config fails
 * closed — there is no silent in-memory fallback.
 *
 * Explicit `RANGER_TRIAL_RUNTIME=memory` is for local/e2e fixtures only and
 * may keep one in-process runtime so successive requests in that Node
 * process share stores. Deployed production must not set this.
 */
export function createRangerTrialRuntime(): RangerTrialRuntime {
  if (process.env.RANGER_TRIAL_RUNTIME === "memory") {
    memoryRuntime ??= createInMemoryRangerTrialRuntime({
      userId: V1_PLACEHOLDER_USER_ID,
      createId: () => crypto.randomUUID(),
      createSessionId: () => crypto.randomUUID(),
      createEvidenceId: () => crypto.randomUUID(),
    });
    return memoryRuntime;
  }
  return createSupabaseRangerTrialRuntime();
}
