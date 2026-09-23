import "server-only";

import { isDeployedHost } from "@/server/debug-tools/is-debug-tools-enabled";

export type ContextualPromotionRuntimeMode = "memory" | "file" | "supabase";

export type ContextualPromotionRuntimeErrorCode =
  | "PROMOTION_RUNTIME_MISSING"
  | "PROMOTION_RUNTIME_INVALID"
  | "PROMOTION_RUNTIME_FORBIDDEN";

export class ContextualPromotionRuntimeError extends Error {
  readonly code: ContextualPromotionRuntimeErrorCode;

  constructor(code: ContextualPromotionRuntimeErrorCode, message: string) {
    super(message);
    this.name = "ContextualPromotionRuntimeError";
    this.code = code;
  }
}

/**
 * Explicit promotion-repository selector.
 * Do not read CONTEXTUAL_RELEASE_RUNTIME, CONTEXT_LAB_RUNTIME,
 * CONTEXTUAL_CONTENT_REVIEW_*, or GAME_RUNTIME.
 */
export function resolveContextualPromotionRuntimeMode(
  env: Record<string, string | undefined> = process.env,
): ContextualPromotionRuntimeMode {
  const raw = env.CONTEXTUAL_PROMOTION_RUNTIME?.trim();
  if (!raw) {
    throw new ContextualPromotionRuntimeError(
      "PROMOTION_RUNTIME_MISSING",
      "CONTEXTUAL_PROMOTION_RUNTIME must be set to memory, file, or supabase.",
    );
  }
  if (raw !== "memory" && raw !== "file" && raw !== "supabase") {
    throw new ContextualPromotionRuntimeError(
      "PROMOTION_RUNTIME_INVALID",
      "CONTEXTUAL_PROMOTION_RUNTIME must be set to memory, file, or supabase.",
    );
  }
  if ((raw === "memory" || raw === "file") && isDeployedHost(env)) {
    throw new ContextualPromotionRuntimeError(
      "PROMOTION_RUNTIME_FORBIDDEN",
      `CONTEXTUAL_PROMOTION_RUNTIME=${raw} is not allowed in a deployed environment.`,
    );
  }
  return raw;
}
