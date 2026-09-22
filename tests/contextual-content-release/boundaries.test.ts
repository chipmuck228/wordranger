import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  experimentalMealContextLabPack,
  listSceneContentRegistry,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
} from "@/contextual-learning/candidate-v0/content";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

describe("release pipeline boundaries", () => {
  it("keeps the Candidate release module free of server, Evidence, evaluator, learner, scheduler, and /train", () => {
    const files = walk("src/contextual-learning/candidate-v0/release");
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@\/server\/|src\/server\//);
      expect(source, file).not.toMatch(/processEvidence|submitTaskAction|default-task-evaluator/);
      expect(source, file).not.toMatch(/LearningEvidence|StudentLexemeModel|learner-repository/);
      expect(source, file).not.toMatch(/@\/server\/scheduler|createScheduler/);
      expect(source, file).not.toContain('"/train"');
    }
  });

  it("does not let the server release layer write Evidence or /train", () => {
    const files = walk("src/server/contextual-content-release");
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/processEvidence|submitTaskAction|LearningEvidence|StudentLexemeModel/);
      expect(source, file).not.toContain('href="/train"');
    }
    const actions = readFileSync("src/app/debug/contextual-content-release/actions.ts", "utf8");
    expect(actions).not.toContain("userId");
    expect(actions).not.toContain("publishedBy");
    expect(actions).not.toContain("processEvidence");
    expect(actions).not.toContain('href="/train"');
  });

  it("keeps default Context Lab on the code-defined six-word pack unless active-release is selected", () => {
    expect(experimentalMealContextLabPack().id).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID);
    expect(experimentalMealContextLabPack().lexemes).toHaveLength(6);
    const registry = listSceneContentRegistry();
    expect(registry.map((item) => item.packId)).toEqual([
      "meal-home-breakfast-v0",
      "meal-scene-expansion-batch-01",
      "meal-scene-expansion-batch-02",
    ]);
    expect(registry.every((item) => item.status === "APPROVED_FOR_EXPERIMENT")).toBe(true);
  });
});
