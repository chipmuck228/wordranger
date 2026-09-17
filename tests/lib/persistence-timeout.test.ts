import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTimedFetch,
  PersistenceTimeoutError,
  withPersistenceTimeout,
} from "@/lib/runtime/persistence-timeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("withPersistenceTimeout", () => {
  it("rejects a hanging promise with PersistenceTimeoutError and clears the timer", async () => {
    vi.useFakeTimers();
    const pending = withPersistenceTimeout(new Promise(() => undefined), 40);
    const assertion = expect(pending).rejects.toBeInstanceOf(
      PersistenceTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(40);
    await assertion;
  });

  it("resolves when the operation finishes first", async () => {
    await expect(
      withPersistenceTimeout(Promise.resolve("ok"), 50),
    ).resolves.toBe("ok");
  });
});

describe("createTimedFetch", () => {
  it("turns a stalled fetch into PersistenceTimeoutError", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    const timed = createTimedFetch(20, fetchImpl);
    await expect(timed("https://example.test/rest/v1/game_sessions")).rejects.toBeInstanceOf(
      PersistenceTimeoutError,
    );
  });
});
