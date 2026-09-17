import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Scheduler domain import boundary", () => {
  it("does not import DefaultTaskGenerator, TaskEvaluator, or submitTaskAction", () => {
    const dir = join(process.cwd(), "src/domain/scheduler");
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts")) {
        continue;
      }
      const text = readFileSync(join(dir, file), "utf8");
      expect(text, file).not.toMatch(/DefaultTaskGenerator/);
      expect(text, file).not.toMatch(/TaskEvaluator/);
      expect(text, file).not.toMatch(/submitTaskAction/);
      expect(text, file).not.toMatch(/placement-metadata/);
      expect(text, file).not.toMatch(/listPlacementMetadata/);
    }
  });
});
