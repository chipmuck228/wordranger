import "server-only";

const TEST_IDENTITY_GATE = "WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY";

export function isDeployedIdentityRuntime(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.NODE_ENV === "production" ||
    env.VERCEL === "1" ||
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview"
  );
}

export function isFreePracticeAuthConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isFreePracticeTestIdentityAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[TEST_IDENTITY_GATE] === "1" && !isDeployedIdentityRuntime(env);
}
