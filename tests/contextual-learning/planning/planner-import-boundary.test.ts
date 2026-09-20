import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { planExperience } from "@/contextual-learning/candidate-v0/planning";
import { mealInput } from "./helpers";

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

describe("Candidate V0 planner import boundary", () => {
  const root = join(process.cwd(), "src/contextual-learning/candidate-v0/planning");
  const files = walk(root);
  const texts = files.map((file) => ({ file, text: readFileSync(file, "utf8") }));

  it("does not import Scheduler, learner engine, Evidence, or StudentLexemeModel", () => {
    const forbidden = [
      "process-evidence",
      "processEvidence",
      "evidence-factory",
      "LearningEvidence",
      "StudentLexemeModel",
      "learning-repository",
      "submit-task-action",
      "default-task-evaluator",
      "domain/scheduler",
      "UNSEEN",
      "RANGER_TRIAL",
      "WORD_BUBBLE",
      "selectRenderer",
    ];
    for (const { file, text } of texts) {
      for (const token of forbidden) {
        expect(text, file).not.toContain(token);
      }
    }
  });

  it("does not create Evidence or select renderer ids in a successful result", () => {
    const planned = planExperience(mealInput("RETRIEVE"));
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    expect(planned).not.toHaveProperty("learningEvidence");
    expect(planned).not.toHaveProperty("evidence");
    expect(planned).not.toHaveProperty("rendererId");
    expect(JSON.stringify(planned)).not.toMatch(/RANGER_TRIAL|WORD_BUBBLE|MATCHING|SNAKE/);
  });

  it("is not re-exported from the Candidate root barrel", () => {
    const rootIndex = readFileSync(
      join(process.cwd(), "src/contextual-learning/candidate-v0/index.ts"),
      "utf8",
    );
    expect(rootIndex).not.toContain("./planning");
    expect(rootIndex).not.toContain("planExperience");
  });
});
