import "server-only";

import { isDeployedHost } from "@/server/debug-tools/is-debug-tools-enabled";

export type ContextualReleaseRuntimeMode = "memory" | "file";

export class ContextualReleaseRuntimeError extends Error {
  readonly code = "CONTEXTUAL_RELEASE_RUNTIME_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "ContextualReleaseRuntimeError";
  }
}

/**
 * Explicit release-repository selector.
 * Do not read CONTEXT_LAB_RUNTIME or GAME_RUNTIME.
 */
export function resolveContextualReleaseRuntimeMode(
  env: Record<string, string | undefined> = process.env,
): ContextualReleaseRuntimeMode {
  const raw = env.CONTEXTUAL_RELEASE_RUNTIME?.trim();
  if (raw !== "memory" && raw !== "file") {
    throw new ContextualReleaseRuntimeError(
      "CONTEXTUAL_RELEASE_RUNTIME must be set to memory or file",
    );
  }
  if (isDeployedHost(env)) {
    throw new ContextualReleaseRuntimeError(
      "CONTEXTUAL_RELEASE_RUNTIME memory/file writes are not allowed in a deployed environment",
    );
  }
  return raw;
}

export function assertReleaseRuntimeWriteAllowed(
  env: Record<string, string | undefined> = process.env,
): void {
  resolveContextualReleaseRuntimeMode(env);
}
