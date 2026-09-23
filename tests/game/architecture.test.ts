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
      join(process.cwd(), "src/components/game/matching"),
      join(process.cwd(), "src/components/game/snake"),
      join(process.cwd(), "src/components/game/shared"),
      join(process.cwd(), "src/components/training"),
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

  it("snake-engine stays free of learning and server imports", () => {
    const engine = readFileSync(
      join(process.cwd(), "src/components/game/snake/snake-engine.ts"),
      "utf8",
    );
    expect(engine).not.toMatch(/@\/domain\/learning/);
    expect(engine).not.toMatch(/@\/server\//);
    expect(engine).not.toMatch(/@supabase/);
    expect(engine).not.toMatch(/next\//);
    expect(engine).not.toMatch(/StudentLexemeModel/);
    expect(engine).not.toMatch(/submitTaskAction/);
  });

  it("Daily Training client does not import Core, Scheduler, or AnswerKey", () => {
    const files = [
      join(process.cwd(), "src/app/train/daily-training-play-client.tsx"),
      join(process.cwd(), "src/components/training/TrainingRenderer.tsx"),
      join(process.cwd(), "src/components/training/DirectPracticeRenderer.tsx"),
      join(process.cwd(), "src/components/training/TrainingComplete.tsx"),
      join(process.cwd(), "src/components/training/home-daily-status.tsx"),
      join(process.cwd(), "src/components/training/inline-training-feedback.tsx"),
      join(process.cwd(), "src/components/home/home-practice-entry.tsx"),
    ];
    const forbidden = [
      "TaskEvaluator",
      "LearningRepository",
      "DeterministicScheduler",
      "DefaultTaskGenerator",
      "@supabase",
      "TaskAnswerKey",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const token of forbidden) {
        expect(text, `${file} ${token}`).not.toMatch(new RegExp(token));
      }
    }
  });

  it("renderer selector inspects PublicLearningTask only", () => {
    for (const file of [
      join(process.cwd(), "src/server/training/renderer-selector.ts"),
      join(process.cwd(), "src/server/training/daily-training-renderer-policy.ts"),
    ]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/AnswerKey/);
      expect(text).not.toMatch(/correctOptionIds/);
      expect(text).not.toMatch(/expectedAnswer/);
      expect(text).not.toMatch(/Math\.random/);
    }
  });
});
