import "server-only";

export type {
  FreePracticeAuthUser,
  FreePracticeIdentityKind,
  FreePracticeIdentityResult,
  FreePracticeIdentityUnavailableReason,
  FreePracticeSessionRead,
  ReadFreePracticeSession,
} from "./types";
export { requireFreePracticeIdentity } from "./require-free-practice-identity";
export { resolveFreePracticeIdentity } from "./resolve-free-practice-identity";
export { createTestFreePracticeSessionReader } from "./test-session-reader";
export { readFreePracticeSupabaseSession } from "./supabase-session-reader";
export {
  isDeployedIdentityRuntime,
  isFreePracticeAuthConfigured,
  isFreePracticeTestIdentityAllowed,
  isPublicDeployedHost,
} from "./runtime";
