export const DEFAULT_PERSISTENCE_TIMEOUT_MS = 8_000;

export class PersistenceTimeoutError extends Error {
  readonly name = "PersistenceTimeoutError";

  constructor(message = "Persistence operation timed out") {
    super(message);
  }
}

export function persistenceTimeoutMs(): number {
  const raw = process.env.WORD_RANGER_PERSISTENCE_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_PERSISTENCE_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PERSISTENCE_TIMEOUT_MS;
  }
  return parsed;
}

export function isPersistenceTimeoutError(
  error: unknown,
): error is PersistenceTimeoutError {
  return error instanceof PersistenceTimeoutError;
}

export function isAbortLike(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "PersistenceTimeoutError" ||
    message.includes("aborted due to timeout") ||
    message.includes("The operation was aborted")
  );
}

export async function withPersistenceTimeout<T>(
  operation: Promise<T>,
  timeoutMs = persistenceTimeoutMs(),
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new PersistenceTimeoutError(
              `Operation exceeded ${timeoutMs}ms`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function createTimedFetch(
  timeoutMs = persistenceTimeoutMs(),
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    const external = init?.signal;
    if (external) {
      if (external.aborted) {
        controller.abort();
      } else {
        external.addEventListener("abort", onExternalAbort, { once: true });
      }
    }
    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (isAbortLike(error) || controller.signal.aborted) {
        throw new PersistenceTimeoutError("Supabase request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    }
  };
}
