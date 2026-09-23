/**
 * Internal Debug Tools gate. Default is closed.
 * Hiding the Settings group is not authorization.
 */

export function isDeployedHost(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
}

export function isDebugToolsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.DEBUG_TOOLS_ENABLED !== "1") {
    return false;
  }
  return !isDeployedHost(env);
}
