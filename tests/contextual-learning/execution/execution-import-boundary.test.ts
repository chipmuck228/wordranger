import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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

describe("Candidate V0 execution import boundary", () => {
  const root = join(
    process.cwd(),
    "src/contextual-learning/candidate-v0/execution",
  );
  const files = walk(root);

  it("does not import evaluator, evidence, learner state, or scheduler", () => {
    const forbidden = [
      "default-task-evaluator",
      "evidence-factory",
      "process-evidence",
      "learning-repository",
      "submit-task-action",
      "student-lexeme-model",
      "scheduler",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const importLines = text
        .split("\n")
        .filter((line) => line.includes("import") && line.includes("from "));
      for (const line of importLines) {
        for (const moduleName of forbidden) {
          expect(line, file).not.toContain(moduleName);
        }
      }
    }
  });

  it("may import PublicLearningTask as a type and the Candidate compiler", () => {
    const issue = readFileSync(join(root, "issue-current-step.ts"), "utf8");
    expect(issue).toContain("compileExperienceStep");
    const types = readFileSync(join(root, "types.ts"), "utf8");
    expect(types).toMatch(
      /import type \{ PublicLearningTask \} from "@\/domain\/tasks\/public-learning-task"/,
    );
  });

  it("keeps Guided activity types and completion off Evidence and PublicLearningTask", () => {
    const activity = readFileSync(join(root, "guided-activity.ts"), "utf8");
    const completion = readFileSync(
      join(root, "record-guided-activity-completion.ts"),
      "utf8",
    );
    expect(activity).not.toContain("PublicLearningTask");
    expect(activity).not.toContain("LearningEvidence");
    expect(activity).not.toContain("processEvidence");
    expect(activity).not.toContain("evidence-factory");
    expect(activity).not.toContain("StudentLexemeModel");
    expect(completion).not.toContain("processEvidence");
    expect(completion).not.toContain("evidence-factory");
    expect(completion).not.toContain("LearningEvidence");
    expect(completion).not.toContain("StudentLexemeModel");
  });
});
