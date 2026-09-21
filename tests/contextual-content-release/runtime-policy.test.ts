import { describe, expect, it } from "vitest";
import {
  ContextualReleaseRuntimeError,
  resolveContextualReleaseRuntimeMode,
} from "@/server/contextual-content-release/runtime-mode";
import {
  isContextualContentReleaseEnabled,
  isContextualContentReleaseWriteEnabled,
} from "@/server/contextual-content-release/gates";

describe("contextual release runtime policy", () => {
  it("fails closed when CONTEXTUAL_RELEASE_RUNTIME is missing or illegal", () => {
    expect(() => resolveContextualReleaseRuntimeMode({})).toThrow(ContextualReleaseRuntimeError);
    expect(() =>
      resolveContextualReleaseRuntimeMode({ CONTEXTUAL_RELEASE_RUNTIME: "supabase" }),
    ).toThrow(ContextualReleaseRuntimeError);
    expect(() =>
      resolveContextualReleaseRuntimeMode({ CONTEXTUAL_RELEASE_RUNTIME: "memory", GAME_RUNTIME: "memory" }),
    ).not.toThrow();
    expect(resolveContextualReleaseRuntimeMode({ CONTEXTUAL_RELEASE_RUNTIME: "file" })).toBe("file");
  });

  it("forbids memory and file on deployed hosts", () => {
    expect(() =>
      resolveContextualReleaseRuntimeMode({
        CONTEXTUAL_RELEASE_RUNTIME: "memory",
        VERCEL_ENV: "production",
      }),
    ).toThrow(/deployed/);
    expect(() =>
      resolveContextualReleaseRuntimeMode({
        CONTEXTUAL_RELEASE_RUNTIME: "file",
        VERCEL_ENV: "preview",
      }),
    ).toThrow(/deployed/);
  });

  it("does not reuse Context Lab or game runtime flags", () => {
    expect(() =>
      resolveContextualReleaseRuntimeMode({
        CONTEXT_LAB_RUNTIME: "memory",
        GAME_RUNTIME: "memory",
      }),
    ).toThrow(ContextualReleaseRuntimeError);
  });

  it("keeps release flags local-only", () => {
    expect(isContextualContentReleaseEnabled({})).toBe(false);
    expect(
      isContextualContentReleaseEnabled({ CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1" }),
    ).toBe(true);
    expect(
      isContextualContentReleaseEnabled({
        CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
    expect(
      isContextualContentReleaseWriteEnabled({
        CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
        CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
        VERCEL_ENV: "preview",
      }),
    ).toBe(false);
  });
});
