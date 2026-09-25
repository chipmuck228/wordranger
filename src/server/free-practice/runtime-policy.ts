import "server-only";

import { isPublicDeployedHost } from "@/server/free-practice/identity/runtime";

export type FreePracticeRuntimeMode = "memory" | "supabase";

export type FreePracticeRuntimeDecision =
  | { status: "DISABLED" }
  | { status: "INVALID" }
  | { status: "FORBIDDEN"; reason: "MEMORY_ON_DEPLOYED_HOST" }
  | { status: "READY"; mode: FreePracticeRuntimeMode };

export function isFreePracticeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.FREE_PRACTICE_ENABLED === "1";
}

export function isFreePracticeDeployedHost(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isPublicDeployedHost(env);
}

export function resolveFreePracticeRuntime(
  env: Record<string, string | undefined> = process.env,
): FreePracticeRuntimeDecision {
  if (!isFreePracticeEnabled(env)) {
    return { status: "DISABLED" };
  }
  const mode = env.FREE_PRACTICE_RUNTIME;
  if (mode === "memory") {
    if (isFreePracticeDeployedHost(env)) {
      return { status: "FORBIDDEN", reason: "MEMORY_ON_DEPLOYED_HOST" };
    }
    return { status: "READY", mode: "memory" };
  }
  if (mode === "supabase") {
    return { status: "READY", mode: "supabase" };
  }
  return { status: "INVALID" };
}

export function isFreePracticePageAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return resolveFreePracticeRuntime(env).status === "READY";
}

export function isFreePracticeE2eProbeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.WORD_RANGER_FREE_PRACTICE_E2E_PROBE !== "1") {
    return false;
  }
  const runtime = resolveFreePracticeRuntime(env);
  if (runtime.status !== "READY" || runtime.mode !== "memory") {
    return false;
  }
  if (isFreePracticeDeployedHost(env)) {
    return false;
  }
  return env.NODE_ENV === "test" || env.WORD_RANGER_FREE_PRACTICE_E2E === "1";
}
