import { isDeployedHost } from "@/server/debug-tools/is-debug-tools-enabled";

/**
 * Projection / UI / server-operation availability.
 * Independent of review and release flags. Allowed on deployed hosts so
 * release assembly can read a supabase promotion store.
 */
export function isContextualContentPromotionEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CONTEXTUAL_CONTENT_PROMOTION_ENABLED === "1";
}

/**
 * Promote-reviewed-batch write gate.
 * Requires promotion enabled. Never inherits review write.
 * Deployed production/preview stay closed.
 */
export function isContextualContentPromotionWriteEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED !== "1") {
    return false;
  }
  if (!isContextualContentPromotionEnabled(env)) {
    return false;
  }
  return !isDeployedHost(env);
}
