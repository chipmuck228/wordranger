import { afterEach, describe, expect, it } from "vitest";
import {
  clearMemoryFreePracticeRuntimeForTests,
  createFreePracticeRuntime,
  FREE_PRACTICE_MEMORY_TEST_USER_ID,
  type InMemoryFreePracticeRuntime,
} from "@/server/free-practice/create-free-practice-runtime";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";

const MEMORY_ENV = {
  FREE_PRACTICE_ENABLED: "1",
  FREE_PRACTICE_RUNTIME: "memory",
  WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY: "1",
  NODE_ENV: "test",
};

afterEach(() => {
  clearMemoryFreePracticeRuntimeForTests();
});

describe("Free Practice Direct UI runtime", () => {
  it("starts a memory session without accepting a client userId", async () => {
    const controller = createFreePracticeRuntime(MEMORY_ENV).createController();
    const started = await controller.start({
      source: "UNSEEN",
      requestedCount: 5,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(started.status).toBe("STARTED");
    if (started.status !== "STARTED") {
      return;
    }
    expect(started.session.plannedCount).toBe(5);
    expect(JSON.stringify(started)).not.toContain(V1_PLACEHOLDER_USER_ID);
    expect(JSON.stringify(started)).not.toContain(
      FREE_PRACTICE_MEMORY_TEST_USER_ID,
    );
    expect(JSON.stringify(started)).not.toMatch(/answerKey|correctOptionIds/);
  });

  it("returns EMPTY without creating a session", async () => {
    const runtime = createFreePracticeRuntime(
      MEMORY_ENV,
    ) as InMemoryFreePracticeRuntime;
    const empty = await runtime.createController().start({
      source: "RECENTLY_INCORRECT",
      requestedCount: 10,
    });
    expect(empty).toEqual({
      status: "EMPTY",
      source: "RECENTLY_INCORRECT",
      requestedCount: 10,
      reason: "NO_ELIGIBLE_WORDS",
    });
    expect(runtime.sessions.count()).toBe(0);
  });
});
