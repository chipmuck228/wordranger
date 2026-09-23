import "server-only";

/**
 * Client payloads may contain a `userId` field. Free Practice identity
 * must never read it. This helper exists so tests can prove a malicious
 * payload is discarded.
 */
export function ignoreUntrustedClientUserId(payload: unknown): void {
  if (!payload || typeof payload !== "object") {
    return;
  }
  void (payload as { userId?: unknown }).userId;
}
