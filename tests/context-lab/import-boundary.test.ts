import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(full)) {
      files.push(full);
    }
  }
  return files;
}

const CLIENT_ROOTS = [
  join(process.cwd(), "src/components/context-lab"),
  join(process.cwd(), "src/app/play/context-lab/context-lab-client.tsx"),
];

const SERVER_ROOTS = [
  join(process.cwd(), "src/server/context-lab"),
  join(process.cwd(), "src/app/play/context-lab/page.tsx"),
];

const FORBIDDEN_IMPORTS = [
  "default-task-evaluator",
  "TaskEvaluator",
  "evidence-factory",
  "EvidenceFactory",
  "process-evidence",
  "processEvidence",
  "learning-repository",
  "submit-task-action",
  "task-answer-key",
  "TaskAnswerKey",
  "student-lexeme-model",
  "StudentLexemeModel",
  "@/domain/scheduler",
  "@/server/scheduler",
];

function importLines(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.includes("import") && line.includes("from "));
}

function filesFrom(roots: string[]): string[] {
  return roots.flatMap((root) =>
    statSync(root).isDirectory() ? walk(root) : [root],
  );
}

describe("Context Lab import boundary", () => {
  it("client presentation cannot import evaluator, Evidence, learner state, or Scheduler", () => {
    for (const file of filesFrom(CLIENT_ROOTS)) {
      const lines = importLines(file);
      for (const line of lines) {
        for (const moduleName of FORBIDDEN_IMPORTS) {
          expect(line, file).not.toContain(moduleName);
        }
        expect(line, file).not.toContain("prepare-meal-context-lab");
        expect(line, file).not.toContain("compile-experience-step");
        expect(line, file).not.toContain("plan-experience");
        expect(line, file).not.toContain("issue-current-step");
      }
    }
  });

  it("server preparation also stays off the frozen evaluator and Evidence path", () => {
    for (const file of filesFrom(SERVER_ROOTS)) {
      const lines = importLines(file);
      for (const line of lines) {
        for (const moduleName of [
          "default-task-evaluator",
          "evidence-factory",
          "process-evidence",
          "submit-task-action",
          "task-answer-key",
          "@/domain/scheduler",
          "@/server/scheduler",
        ]) {
          expect(line, file).not.toContain(moduleName);
        }
      }
    }
  });

  it("does not appear in production home or train navigation", () => {
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    const train = readFileSync(
      join(process.cwd(), "src/app/train/daily-training-play-client.tsx"),
      "utf8",
    );
    expect(home).not.toContain("/play/context-lab");
    expect(train).not.toContain("/play/context-lab");
    expect(train).not.toContain("Context Lab");
  });
});
