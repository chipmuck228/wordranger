import "server-only";

import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { ContextLabError } from "./context-lab-errors";

export type ContextLabRuntimeMode = "memory" | "supabase";

/**
 * Explicit Context Lab repository selector.
 * Do not read GAME_RUNTIME or RANGER_TRIAL_RUNTIME.
 *
 * Memory is allowed only when selected explicitly and the process is not a
 * deployed Vercel production/preview host. Playwright / local `next start`
 * leave VERCEL_ENV unset, so CONTEXT_LAB_RUNTIME=memory remains valid there.
 */
export function resolveContextLabRuntimeMode(
  env: Record<string, string | undefined> = process.env,
): ContextLabRuntimeMode {
  const raw = env.CONTEXT_LAB_RUNTIME?.trim();
  if (raw !== "memory" && raw !== "supabase") {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID,
      "CONTEXT_LAB_RUNTIME must be set to memory or supabase",
      false,
    );
  }
  if (raw === "memory" && isDeployedContextLabHost(env)) {
    throw new ContextLabError(
      CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID,
      "CONTEXT_LAB_RUNTIME=memory is not allowed in a deployed environment",
      false,
    );
  }
  return raw;
}

export function isDeployedContextLabHost(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
}
