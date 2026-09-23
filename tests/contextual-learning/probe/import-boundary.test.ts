import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("probe import boundary", () => {
  const root = join(process.cwd(), "src/contextual-learning/candidate-v0/probe");
  const texts = walk(root).map((file) => ({
    file,
    text: readFileSync(file, "utf8"),
  }));

  it("does not import evaluator, Evidence writes, Scheduler, or /train", () => {
    const forbidden = [
      "default-task-evaluator",
      "evidence-factory",
      "submit-task-action",
      "process-evidence",
      "processEvidence",
      "learning-repository",
      "domain/scheduler",
      "daily-training",
      "/train",
    ];
    for (const { file, text } of texts) {
      for (const line of text.split("\n").filter((item) => /^\s*import\b/.test(item))) {
        for (const token of forbidden) {
          expect(line, file).not.toContain(token);
        }
      }
    }
  });
});
