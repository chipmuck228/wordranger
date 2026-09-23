import "server-only";

import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { ignoreUntrustedClientUserId } from "./ignore-untrusted-user-id";
import { isFreePracticeAuthConfigured } from "./runtime";
import type {
  FreePracticeIdentityResult,
  ReadFreePracticeSession,
} from "./types";

export interface ResolveFreePracticeIdentityInput {
  untrustedClientPayload?: unknown;
  env?: Record<string, string | undefined>;
  readSession?: ReadFreePracticeSession;
}

function unavailable(
  reason: Extract<FreePracticeIdentityResult, { status: "UNAVAILABLE" }>["reason"],
): FreePracticeIdentityResult {
  return { status: "UNAVAILABLE", reason };
}

function fromSessionUser(userId: string, isAnonymous: boolean): FreePracticeIdentityResult {
  if (!userId || userId === V1_PLACEHOLDER_USER_ID) {
    return unavailable("PLACEHOLDER_FORBIDDEN");
  }
  return {
    status: "AUTHENTICATED",
    userId,
    identityKind: isAnonymous ? "SUPABASE_ANONYMOUS" : "SUPABASE_USER",
  };
}

export async function resolveFreePracticeIdentity(
  input: ResolveFreePracticeIdentityInput = {},
): Promise<FreePracticeIdentityResult> {
  ignoreUntrustedClientUserId(input.untrustedClientPayload);
  const env = input.env ?? process.env;

  if (input.readSession) {
    try {
      const session = await input.readSession();
      if (session.status === "AUTHENTICATED") {
        return fromSessionUser(session.user.id, session.user.isAnonymous);
      }
      return unavailable("NO_SERVER_SESSION");
    } catch {
      return unavailable("NO_SERVER_SESSION");
    }
  }

  if (!isFreePracticeAuthConfigured(env)) {
    return unavailable("AUTH_NOT_CONFIGURED");
  }

  return unavailable("NO_SERVER_SESSION");
}
