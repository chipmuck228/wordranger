import "server-only";

const TEST_IDENTITY_GATE = "WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY";
const TEST_E2E_GATE = "WORD_RANGER_FREE_PRACTICE_E2E";

export function isPublicDeployedHost(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.VERCEL === "1" ||
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview" ||
    env.CF_PAGES === "1" ||
    env.NETLIFY === "true" ||
    env.RENDER === "true" ||
    Boolean(env.FLY_APP_NAME)
  );
}

export function isDeployedIdentityRuntime(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "production" || isPublicDeployedHost(env);
}

export function isFreePracticeAuthConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isFreePracticeTestIdentityAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env[TEST_IDENTITY_GATE] !== "1") {
    return false;
  }
  if (isPublicDeployedHost(env)) {
    return false;
  }
  return (
    env.NODE_ENV === "test" ||
    env.NODE_ENV === "development" ||
    env[TEST_E2E_GATE] === "1"
  );
}
