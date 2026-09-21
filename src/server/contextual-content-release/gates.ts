import { isDeployedHost } from "@/server/debug-tools/is-debug-tools-enabled";

export function isContextualContentReleaseEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.CONTEXTUAL_CONTENT_RELEASE_ENABLED !== "1") {
    return false;
  }
  return !isDeployedHost(env);
}

export function isContextualContentReleaseWriteEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED !== "1") {
    return false;
  }
  if (!isContextualContentReleaseEnabled(env)) {
    return false;
  }
  return !isDeployedHost(env);
}
