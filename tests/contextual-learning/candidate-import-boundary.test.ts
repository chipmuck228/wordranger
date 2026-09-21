import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import { createMealLexicalBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import {
  homeBreakfastFrame,
  restaurantMealFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { identityForFixtureSense } from "@/contextual-learning/candidate-v0/strengthen/meal-lexical-profiles";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { mealBuildPlanningInput } from "@/server/context-lab/meal-context-lab-controller";

function walkProductionTs(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walkProductionTs(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(full) && !full.includes(".test.")) {
      files.push(full);
    }
  }
  return files;
}

function importedModules(source: string): string[] {
  const modules: string[] = [];
  const pattern =
    /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1]) {
      modules.push(match[1]);
    }
  }
  return modules;
}

function resolvesToServer(specifier: string, file: string): boolean {
  if (specifier.startsWith("@/server/") || specifier.includes("src/server/")) {
    return true;
  }
  if (!specifier.startsWith(".")) {
    return false;
  }
  const resolved = normalize(join(dirname(file), specifier));
  const marker = `${sep}src${sep}server${sep}`;
  return resolved.includes(marker) || resolved.endsWith(`${sep}src${sep}server`);
}

describe("Candidate V0 must not import server runtime", () => {
  const candidateRoot = join(process.cwd(), "src/contextual-learning/candidate-v0");
  const files = walkProductionTs(candidateRoot);

  it("forbids @/server and src/server imports across the whole Candidate tree", () => {
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const specifier of importedModules(source)) {
        expect(
          resolvesToServer(specifier, file),
          `${file} imports ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it("keeps Meal plans free of the bundled server loader name", () => {
    const plans = readFileSync(
      join(candidateRoot, "fixtures/meal/plans.ts"),
      "utf8",
    );
    expect(plans).not.toContain("bundledSceneLexemeLoader");
    expect(plans).not.toContain("@/server/");
    expect(plans).toContain("SceneLexemeLoader");
  });

  it("does not let the Candidate root barrel load server vocabulary runtime", () => {
    const barrel = readFileSync(join(candidateRoot, "index.ts"), "utf8");
    expect(barrel).toContain("./fixtures/meal/plans");
    const visited = new Set<string>();
    const queue = [join(candidateRoot, "index.ts")];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (visited.has(file) || !existsSync(file)) {
        continue;
      }
      visited.add(file);
      const source = readFileSync(file, "utf8");
      for (const specifier of importedModules(source)) {
        expect(resolvesToServer(specifier, file), `${file} → ${specifier}`).toBe(
          false,
        );
        if (specifier.startsWith(".")) {
          const resolved = normalize(join(dirname(file), specifier));
          const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, join(resolved, "index.ts")];
          queue.push(...candidates.filter((item) => existsSync(item)));
        }
      }
    }
    expect(visited.size).toBeGreaterThan(5);
  });

  it("keeps bundled-scene-lexeme-loader on the server layer", () => {
    expect(
      existsSync(join(process.cwd(), "src/server/runtime/bundled-scene-lexeme-loader.ts")),
    ).toBe(true);
    expect(
      existsSync(join(candidateRoot, "fixtures/meal/scene-lexeme-loader.ts")),
    ).toBe(false);
  });

  it("lets the server adapter inject the bundled loader into Candidate plans", () => {
    const input = mealBuildPlanningInput();
    expect(input.loadLexeme).toBe(bundledSceneLexemeLoader);
    const identity = identityForFixtureSense(MEAL_SENSE.soup);
    expect(identity).not.toBeNull();
    const home = createMealLexicalBuildPlan({
      frame: homeBreakfastFrame,
      profile: identity!,
      loadLexeme: bundledSceneLexemeLoader,
    });
    const restaurant = createMealLexicalBuildPlan({
      frame: restaurantMealFrame,
      profile: identity!,
      loadLexeme: bundledSceneLexemeLoader,
    });
    expect(home.steps).toHaveLength(6);
    expect(restaurant.steps).toHaveLength(6);
    expect(JSON.stringify(home)).not.toMatch(/answerKey|correctCandidateIds/i);
    expect(JSON.stringify(restaurant)).not.toMatch(/answerKey|correctCandidateIds/i);
  });
});
