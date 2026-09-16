import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("G5 renderer architecture boundary", () => {
  it("does not import Core mutation, evaluation, or AnswerKey modules", () => {
    const dirs = [
      join(process.cwd(), "src/components/game/ranger-trial"),
      join(process.cwd(), "src/components/game/word-bubble"),
      join(process.cwd(), "src/components/game/shared"),
    ];
    const forbidden = [
      "LearningRepository",
      "createLearningEvidenceFromTaskEvaluation",
      "DefaultTaskGenerator",
      "DeterministicScheduler",
      "TaskAnswerKey",
      "@supabase",
      "submitTaskAction",
      "EvidenceOutcome",
      "EvidenceErrorType",
      "MasteryStage",
      "RetentionState",
      "correctOptionIds",
      "processEvidence",
    ];
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        for (const token of forbidden) {
          expect(text, `${file} ${token}`).not.toMatch(new RegExp(token));
        }
      }
    }
  });
});
