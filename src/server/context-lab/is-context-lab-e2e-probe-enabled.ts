import { isContextLabEnabled } from "./is-context-lab-enabled";
import { isDeployedContextLabHost } from "./context-lab-runtime-mode";

/**
 * Playwright-only memory inspection. Default is closed.
 *
 * Requires every condition:
 * - CONTEXT_LAB_E2E_PROBE_ENABLED=1
 * - CONTEXT_LAB_ENABLED=1
 * - CONTEXT_LAB_RUNTIME=memory
 * - an explicit local/test host (NODE_ENV=test or CONTEXT_LAB_E2E=1)
 * - not a deployed host
 *
 * Supabase runtime and deployed hosts always fail closed, even when the
 * probe flag is set. Do not put a NEXT_PUBLIC_ copy of this flag in
 * general local development env files.
 */
export function isContextLabE2eProbeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.CONTEXT_LAB_E2E_PROBE_ENABLED !== "1") {
    return false;
  }
  if (!isContextLabEnabled(env)) {
    return false;
  }
  if (env.CONTEXT_LAB_RUNTIME !== "memory") {
    return false;
  }
  if (isContextLabE2eProbeDeployedHost(env)) {
    return false;
  }
  return isExplicitLocalOrTestHost(env);
}

export function isContextLabE2eProbeDeployedHost(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (isDeployedContextLabHost(env)) {
    return true;
  }
  return (
    env.VERCEL === "1" ||
    env.CF_PAGES === "1" ||
    env.NETLIFY === "true" ||
    env.RENDER === "true" ||
    Boolean(env.FLY_APP_NAME)
  );
}

function isExplicitLocalOrTestHost(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "test" || env.CONTEXT_LAB_E2E === "1";
}
