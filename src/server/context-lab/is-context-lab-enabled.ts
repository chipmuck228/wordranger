/**
 * Internal Context Lab gate. Default is closed.
 * Enable only with CONTEXT_LAB_ENABLED=1 on a local/internal process.
 */

export function isContextLabEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CONTEXT_LAB_ENABLED === "1";
}
