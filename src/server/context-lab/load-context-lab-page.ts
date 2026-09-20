import "server-only";

import { isContextLabEnabled } from "./is-context-lab-enabled";

export type ContextLabPageLoad =
  | { kind: "NOT_FOUND" }
  | { kind: "READY" };

/**
 * Feature-gate only. The page then calls startMealContextLab once per
 * request. Refresh is a new request and therefore a new experimental run.
 */
export function loadContextLabPage(
  env: Record<string, string | undefined> = process.env,
): ContextLabPageLoad {
  if (!isContextLabEnabled(env)) {
    return { kind: "NOT_FOUND" };
  }
  return { kind: "READY" };
}
