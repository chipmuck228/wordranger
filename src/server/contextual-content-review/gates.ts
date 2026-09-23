import { isDeployedHost } from "@/server/debug-tools/is-debug-tools-enabled";

export function isContextualContentReviewEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.CONTEXTUAL_CONTENT_REVIEW_ENABLED !== "1") {
    return false;
  }
  return !isDeployedHost(env);
}

export function isContextualContentReviewWriteEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED !== "1") {
    return false;
  }
  if (!isContextualContentReviewEnabled(env)) {
    return false;
  }
  return !isDeployedHost(env);
}
