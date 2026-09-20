import { describe, expect, it } from "vitest";
import { isContextLabEnabled } from "@/server/context-lab/is-context-lab-enabled";
import { loadContextLabPage } from "@/server/context-lab/load-context-lab-page";

describe("Context Lab feature gate", () => {
  it("is closed unless CONTEXT_LAB_ENABLED is exactly 1", () => {
    expect(isContextLabEnabled({})).toBe(false);
    expect(isContextLabEnabled({ CONTEXT_LAB_ENABLED: "true" })).toBe(false);
    expect(isContextLabEnabled({ CONTEXT_LAB_ENABLED: "0" })).toBe(false);
    expect(isContextLabEnabled({ CONTEXT_LAB_ENABLED: "1" })).toBe(true);
  });

  it("does not load an operational pilot when the gate is absent", () => {
    expect(loadContextLabPage({}).kind).toBe("NOT_FOUND");
    expect(loadContextLabPage({ CONTEXT_LAB_ENABLED: "true" }).kind).toBe(
      "NOT_FOUND",
    );
  });

  it("exposes the route shell when the gate is enabled without creating a run", () => {
    const loaded = loadContextLabPage({ CONTEXT_LAB_ENABLED: "1" });
    expect(loaded.kind).toBe("READY");
  });
});
