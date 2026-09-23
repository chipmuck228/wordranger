import "server-only";

import { isFreePracticeAuthConfigured } from "./runtime";
import { resolveFreePracticeIdentity } from "./resolve-free-practice-identity";
import { readFreePracticeSupabaseSession } from "./supabase-session-reader";
import type { FreePracticeIdentityResult } from "./types";

/**
 * Production Free Practice identity entry. Resolves the user from the
 * server cookie session via `auth.getUser()`. Ignores any client
 * `userId`. Never falls back to `V1_PLACEHOLDER_USER_ID`.
 *
 * Do not call this from `/train`. Daily Training stays on the
 * placeholder until a separate contract-changing task.
 */
export async function requireFreePracticeIdentity(
  untrustedClientPayload?: unknown,
  env: Record<string, string | undefined> = process.env,
): Promise<FreePracticeIdentityResult> {
  if (!isFreePracticeAuthConfigured(env)) {
    return { status: "UNAVAILABLE", reason: "AUTH_NOT_CONFIGURED" };
  }
  return resolveFreePracticeIdentity({
    untrustedClientPayload,
    env,
    readSession: () => readFreePracticeSupabaseSession({ env }),
  });
}
