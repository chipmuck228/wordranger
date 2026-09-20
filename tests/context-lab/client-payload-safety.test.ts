import { describe, expect, it } from "vitest";
import { collectKeys, createMealLabHarness, FORBIDDEN_CLIENT_FIELDS } from "./helpers";

describe("Context Lab public payload safety", () => {
  it("client-facing screens contain no future screens or AnswerKey", async () => {
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    expect(first.kind).toBe("GUIDED");
    const keys = collectKeys(first);
    expect(keys.has("screens")).toBe(false);
    expect(keys.has("experienceRun")).toBe(false);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
  });
});
