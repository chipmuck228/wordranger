import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("active-release materialization source boundary", () => {
  const files = [
    "src/server/context-lab/meal-context-lab-controller.ts",
    "src/server/context-lab/meal-presentation-map.ts",
    "src/server/context-lab/present-context-lab-screen.ts",
    "src/server/context-lab/meal-strengthen-profiles.ts",
    "src/server/context-lab/context-lab-content-source.ts",
  ];

  it("does not swallow pinned content failures into undefined pack", () => {
    const text = readFileSync(
      join(process.cwd(), "src/server/context-lab/meal-context-lab-controller.ts"),
      "utf8",
    );
    expect(text).not.toContain(".catch(() => null)");
    expect(text).not.toContain("catch(() => undefined)");
    expect(text).not.toMatch(/resolveContent\([^)]*\)\.catch/);
  });

  it("does not import live batch-03 pack, frames, or skeleton constants", () => {
    const forbidden = [
      "MEAL_SCENE_EXPANSION_BATCH_03_PACK",
      "MEAL_BATCH_03_FRAMES",
      "mealBatch03Skeleton",
      "homeBreakfastBatch03Frame",
    ];
    for (const relative of files) {
      const text = readFileSync(join(process.cwd(), relative), "utf8");
      for (const token of forbidden) {
        expect(text, `${relative} must not import ${token}`).not.toContain(token);
      }
    }
  });
});
