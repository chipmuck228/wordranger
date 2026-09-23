import "server-only";

import { isFreePracticeTestIdentityAllowed } from "./runtime";
import type { FreePracticeSessionRead, ReadFreePracticeSession } from "./types";

export class FreePracticeTestIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FreePracticeTestIdentityError";
  }
}

/**
 * Test-only session reader. Production / Vercel ignores the gate and
 * this factory refuses to run. It never mints a random UUID.
 */
export function createTestFreePracticeSessionReader(input: {
  env?: Record<string, string | undefined>;
  userId: string;
  isAnonymous: boolean;
}): ReadFreePracticeSession {
  const env = input.env ?? process.env;
  if (!isFreePracticeTestIdentityAllowed(env)) {
    throw new FreePracticeTestIdentityError(
      "Free Practice test identity is disabled",
    );
  }
  const userId = input.userId;
  const isAnonymous = input.isAnonymous;
  return async (): Promise<FreePracticeSessionRead> => ({
    status: "AUTHENTICATED",
    user: { id: userId, isAnonymous },
  });
}
