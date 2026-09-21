import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

describe("Candidate V0 experiment promotion boundaries", () => {
  it("keeps Candidate content free of server, Evidence, and processEvidence", () => {
    const files = walk("src/contextual-learning/candidate-v0/content");
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from ["']@\/server\//);
      expect(source, file).not.toMatch(/processEvidence/);
      expect(source, file).not.toContain("ContextualEvidence");
    }
  });

  it("does not let the review browser create or mutate a promotion", () => {
    const actions = readFileSync(
      "src/app/debug/contextual-content-review/actions.ts",
      "utf8",
    );
    const bar = readFileSync(
      "src/app/debug/contextual-content-review/review-decision-bar.tsx",
      "utf8",
    );
    expect(actions).not.toContain("APPROVED_FOR_EXPERIMENT");
    expect(actions).not.toContain("MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION");
    expect(actions).not.toContain("listSceneContentRegistry");
    expect(bar).toContain("不会修改 registry 或 promotion");
    expect(bar).not.toMatch(/<input[\s\S]*fingerprint/);
  });

  it("does not wire promotion into /train or a second Evidence pipeline", () => {
    const train = walk("src/app/train");
    for (const file of train) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("experimentalMealContextLabPack");
      expect(source, file).not.toContain("MEAL_SCENE_EXPANSION_BATCH_01");
    }
    const promotion = readFileSync(
      "src/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01-promotion.ts",
      "utf8",
    );
    expect(promotion).toContain("EXPERIMENT_ONLY");
    expect(promotion).not.toContain("STANDARD");
    expect(promotion).not.toContain("processEvidence");
  });
});
