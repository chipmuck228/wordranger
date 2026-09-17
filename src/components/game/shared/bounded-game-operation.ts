export const CLIENT_GAME_TIMEOUT_MS = 12_000;

export type ClientGameTimeoutResult<T> =
  | { timedOut: true }
  | { timedOut: false; value: T };

/**
 * Secondary client-side bound around a Server Action. Does not cancel the
 * in-flight server work. Callers must ignore late results after leaving
 * the loading screen so a retry does not apply a stale session.
 */
export async function withClientGameTimeout<T>(
  operation: Promise<T>,
  timeoutMs = CLIENT_GAME_TIMEOUT_MS,
): Promise<ClientGameTimeoutResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation.then((value) => ({ timedOut: false as const, value })),
      new Promise<ClientGameTimeoutResult<T>>((resolve) => {
        timer = setTimeout(() => {
          resolve({ timedOut: true });
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
