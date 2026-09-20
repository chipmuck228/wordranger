import { afterEach, describe, expect, it } from "vitest";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { ContextLabError } from "@/server/context-lab/context-lab-errors";
import { resolveContextLabRuntimeMode } from "@/server/context-lab/context-lab-runtime-mode";
import {
  createContextLabRuntime,
  resetMemoryContextLabRepositoryForTests,
} from "@/server/context-lab/create-context-lab-runtime";
import { InMemoryContextLabRunRepository } from "@/server/context-lab/in-memory-context-lab-run-repository";

afterEach(() => {
  resetMemoryContextLabRepositoryForTests();
});

describe("Context Lab runtime policy", () => {
  it("missing runtime config fails closed", () => {
    expect(() => resolveContextLabRuntimeMode({})).toThrow(ContextLabError);
    expect(() =>
      resolveContextLabRuntimeMode({ CONTEXT_LAB_RUNTIME: "maps" }),
    ).toThrow(ContextLabError);
    try {
      resolveContextLabRuntimeMode({ GAME_RUNTIME: "memory" });
    } catch (error) {
      expect(error).toBeInstanceOf(ContextLabError);
      if (error instanceof ContextLabError) {
        expect(error.code).toBe(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID);
      }
    }
  });

  it("does not reuse GAME_RUNTIME or RANGER_TRIAL_RUNTIME", () => {
    expect(() =>
      resolveContextLabRuntimeMode({
        GAME_RUNTIME: "memory",
        RANGER_TRIAL_RUNTIME: "memory",
      }),
    ).toThrow(/CONTEXT_LAB_RUNTIME/);
    expect(
      resolveContextLabRuntimeMode({ CONTEXT_LAB_RUNTIME: "memory" }),
    ).toBe("memory");
  });

  it("rejects memory on a deployed host", () => {
    expect(() =>
      resolveContextLabRuntimeMode({
        CONTEXT_LAB_RUNTIME: "memory",
        VERCEL_ENV: "production",
      }),
    ).toThrow(/deployed/);
  });

  it("disabled feature gate does not create a runtime repository write path", () => {
    expect(() =>
      createContextLabRuntime({
        CONTEXT_LAB_ENABLED: "0",
        CONTEXT_LAB_RUNTIME: "memory",
      }),
    ).toThrow(ContextLabError);
  });

  it("Supabase configuration failure does not fall back to memory", () => {
    try {
      createContextLabRuntime(
        {
          CONTEXT_LAB_ENABLED: "1",
          CONTEXT_LAB_RUNTIME: "supabase",
        },
        { repository: undefined },
      );
      throw new Error("should have failed closed");
    } catch (error) {
      expect(error).toBeInstanceOf(ContextLabError);
      if (error instanceof ContextLabError) {
        expect(error.code).toBe(
          CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID,
        );
        expect(error.message).toMatch(/does not fall back to memory/);
      }
    }
    expect(() =>
      createContextLabRuntime({
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_RUNTIME: "memory",
      }),
    ).not.toThrow();
  });

  it("injected repository is used without touching the process memory singleton", async () => {
    const isolated = new InMemoryContextLabRunRepository();
    const runtime = createContextLabRuntime(
      {
        CONTEXT_LAB_ENABLED: "1",
        CONTEXT_LAB_RUNTIME: "memory",
      },
      { repository: isolated },
    );
    const screen = await runtime.createController().start();
    expect(screen.kind).toBe("GUIDED");
    if (screen.kind !== "GUIDED") {
      throw new Error("guided");
    }
    const fromIsolated = await isolated.get({
      runId: screen.handle.runId,
      userId: runtime.userId,
    });
    expect(fromIsolated).not.toBeNull();
  });
});
