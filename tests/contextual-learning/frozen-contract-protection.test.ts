import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { createMealBuildPlan } from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { profileMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { compilationRequest } from "./helpers";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("Candidate V0 frozen-contract protection", () => {
  const root = join(process.cwd(), "src/contextual-learning/candidate-v0");
  const files = walk(root);

  it("does not redefine PublicLearningTask or LearningEvidence", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/export interface PublicLearningTask/);
      expect(text, file).not.toMatch(/export interface LearningEvidence/);
      expect(text, file).not.toMatch(/export interface ContextualEvidence/);
      expect(text, file).not.toMatch(/export interface ContextualScore/);
    }
  });

  it("does not import learner-state mutation", () => {
    const forbiddenModules = [
      "process-evidence",
      "learning-repository",
      "submit-task-action",
      "default-task-evaluator",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const importLines = text
        .split("\n")
        .filter((line) => line.includes("from ") && line.includes("import"));
      for (const line of importLines) {
        for (const moduleName of forbiddenModules) {
          expect(line, file).not.toContain(moduleName);
        }
      }
    }
  });

  it("imports the frozen PublicLearningTask type for compiler output", () => {
    const compiler = readFileSync(
      join(root, "compilation/types.ts"),
      "utf8",
    );
    expect(compiler).toMatch(
      /import type \{ PublicLearningTask \} from "@\/domain\/tasks\/public-learning-task"/,
    );
  });

  it("emits a value assignable to the frozen PublicLearningTask type", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step: plan.steps[0],
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        profiles: profileMap(MEAL_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    const task: PublicLearningTask = compiled.value.publicLearningTask;
    expect(task.id).toBe(compiled.value.answerKey.taskId);
    expect(task.hints).toBeDefined();
  });
});
