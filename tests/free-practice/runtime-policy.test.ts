import { describe, expect, it } from "vitest";
import {
  isFreePracticeE2eProbeEnabled,
  isFreePracticePageAvailable,
  resolveFreePracticeRuntime,
} from "@/server/free-practice/runtime-policy";

describe("Free Practice runtime policy", () => {
  it("fails closed when the feature flag is missing or invalid", () => {
    expect(resolveFreePracticeRuntime({})).toEqual({ status: "DISABLED" });
    expect(resolveFreePracticeRuntime({ FREE_PRACTICE_ENABLED: "true" })).toEqual(
      { status: "DISABLED" },
    );
    expect(
      resolveFreePracticeRuntime({
        FREE_PRACTICE_ENABLED: "1",
        FREE_PRACTICE_RUNTIME: "GAME_RUNTIME",
      }),
    ).toEqual({ status: "INVALID" });
    expect(isFreePracticePageAvailable({})).toBe(false);
  });

  it("accepts local memory and rejects memory on Vercel", () => {
    expect(
      resolveFreePracticeRuntime({
        FREE_PRACTICE_ENABLED: "1",
        FREE_PRACTICE_RUNTIME: "memory",
        NODE_ENV: "production",
      }),
    ).toEqual({ status: "READY", mode: "memory" });
    expect(
      resolveFreePracticeRuntime({
        FREE_PRACTICE_ENABLED: "1",
        FREE_PRACTICE_RUNTIME: "memory",
        VERCEL: "1",
        VERCEL_ENV: "preview",
      }),
    ).toEqual({ status: "FORBIDDEN", reason: "MEMORY_ON_DEPLOYED_HOST" });
    expect(
      resolveFreePracticeRuntime({
        FREE_PRACTICE_ENABLED: "1",
        FREE_PRACTICE_RUNTIME: "supabase",
        VERCEL: "1",
        VERCEL_ENV: "production",
      }),
    ).toEqual({ status: "READY", mode: "supabase" });
  });

  it("keeps the E2E probe local-only", () => {
    expect(
      isFreePracticeE2eProbeEnabled({
        FREE_PRACTICE_ENABLED: "1",
        FREE_PRACTICE_RUNTIME: "memory",
        WORD_RANGER_FREE_PRACTICE_E2E_PROBE: "1",
        WORD_RANGER_FREE_PRACTICE_E2E: "1",
      }),
    ).toBe(true);
    expect(
      isFreePracticeE2eProbeEnabled({
        FREE_PRACTICE_ENABLED: "1",
        FREE_PRACTICE_RUNTIME: "memory",
        WORD_RANGER_FREE_PRACTICE_E2E_PROBE: "1",
        WORD_RANGER_FREE_PRACTICE_E2E: "1",
        VERCEL_ENV: "preview",
      }),
    ).toBe(false);
    expect(
      isFreePracticeE2eProbeEnabled({
        FREE_PRACTICE_ENABLED: "1",
        FREE_PRACTICE_RUNTIME: "supabase",
        WORD_RANGER_FREE_PRACTICE_E2E_PROBE: "1",
        NODE_ENV: "test",
      }),
    ).toBe(false);
  });
});
