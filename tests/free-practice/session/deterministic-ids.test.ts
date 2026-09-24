import { describe, expect, it } from "vitest";
import { createFreePracticeGenerationIds } from "@/server/free-practice/session/deterministic-ids";

describe("Free Practice deterministic generation ids", () => {
  it("repeats task and option ids for the same session item", () => {
    const first = createFreePracticeGenerationIds("session-1", "item-a");
    const second = createFreePracticeGenerationIds("session-1", "item-a");
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("changes when the session or item changes", () => {
    const a = createFreePracticeGenerationIds("session-1", "item-a")();
    const b = createFreePracticeGenerationIds("session-1", "item-b")();
    const c = createFreePracticeGenerationIds("session-2", "item-a")();
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
