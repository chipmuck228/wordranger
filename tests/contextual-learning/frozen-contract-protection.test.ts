import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { SEMANTIC_PROJECTION_WHITELIST } from "@/contextual-learning/candidate-v0/compilation/semantic-projection";
import { DomainErrorCode } from "@/contextual-learning/candidate-v0/domain/errors";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_PROFILES } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { isAssessableExperienceStep } from "@/contextual-learning/candidate-v0/domain/types";
import {
  createMealBuildPlan,
  createMealStrengthenPlan,
} from "@/contextual-learning/candidate-v0/fixtures/meal/plans";
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

  it("has no generic choice → meaning recognition fallback", () => {
    const choiceAdapter = readFileSync(
      join(root, "compilation/adapters/choice-adapter.ts"),
      "utf8",
    );
    const capabilityRegistry = readFileSync(
      join(root, "capabilities/capability-registry.ts"),
      "utf8",
    );
    expect(choiceAdapter).not.toContain("VocabularySkill.MEANING_RECOGNITION");
    expect(choiceAdapter).not.toContain("LearningTaskType.MEANING_CHOICE");
    expect(choiceAdapter).not.toContain(".includes(");
    expect(choiceAdapter).not.toMatch(/correct:\s*predicate\.expected/);
    expect(choiceAdapter).not.toMatch(/correct:\s*[^\n]*\.expected/);
    expect(capabilityRegistry).toContain("GENERIC_CHOICE_MEANING_RECOGNITION");
    expect(
      SEMANTIC_PROJECTION_WHITELIST.every(
        (projection) =>
          projection.responseKind !== "CLAIM_CHOICE" &&
          projection.responseKind !== "RELATION_CHOICE" &&
          projection.responseKind !== "SEMANTIC_CLASS" &&
          projection.responseKind !== "ENTITY_REF",
      ),
    ).toBe(true);
  });

  it("emits a frozen PublicLearningTask only when a semantic projection exists", () => {
    const plan = createMealBuildPlan(homeBreakfastFrame);
    const recall = plan.steps.find((step) => step.purpose === "RECALL");
    expect(recall && isAssessableExperienceStep(recall)).toBe(true);
    if (!recall || !isAssessableExperienceStep(recall)) {
      return;
    }
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step: recall,
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
    expect(compiled.value.trace.semanticProjectionId.length).toBeGreaterThan(0);
  });

  it("does not emit a PublicLearningTask when no projection exists", () => {
    const plan = createMealStrengthenPlan(homeBreakfastFrame);
    const step = plan.steps[0];
    expect(isAssessableExperienceStep(step)).toBe(true);
    if (!isAssessableExperienceStep(step)) {
      return;
    }
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step,
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        profiles: profileMap(MEAL_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      return;
    }
    expect(compiled.error.code).toBe(DomainErrorCode.COMPILATION_SEMANTIC_MISMATCH);
  });
});
