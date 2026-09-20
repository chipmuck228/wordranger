import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { routeContextualMemory } from "@/contextual-learning/candidate-v0/memory-routing/route-contextual-memory";
import { BUNDLED_SPOON_LEXEME_ID } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";

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

describe("memory-routing import boundary", () => {
  const root = join(
    process.cwd(),
    "src/contextual-learning/candidate-v0/memory-routing",
  );
  const files = walk(root);
  const texts = files.map((file) => ({ file, text: readFileSync(file, "utf8") }));

  it("does not import evaluator, Evidence writes, Scheduler writes, Daily Training, or /train", () => {
    const forbidden = [
      "default-task-evaluator",
      "evidence-factory",
      "submit-task-action",
      "submitTaskAction",
      "process-evidence",
      "processEvidence",
      "learning-repository",
      "plan-learning-session",
      "domain/scheduler",
      "server/scheduler",
      "daily-training",
      "/train",
      "createInitialStudentLexemeModel",
    ];
    for (const { file, text } of texts) {
      const importLines = text
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line));
      for (const line of importLines) {
        for (const token of forbidden) {
          expect(line, file).not.toContain(token);
        }
      }
    }
  });

  it("allows only import type for the frozen LearningNeed / weakness projection", () => {
    const router = readFileSync(join(root, "route-contextual-memory.ts"), "utf8");
    const types = readFileSync(join(root, "types.ts"), "utf8");
    expect(types).toMatch(
      /import type \{ LearningNeed, LearningNeedReason \} from "@\/domain\/learning\/learning-need"/,
    );
    expect(types).toMatch(
      /import type \{ WeaknessType \} from "@\/domain\/learning\/weakness\.types"/,
    );
    expect(router).toMatch(
      /import type \{ LearningNeedReason \} from "@\/domain\/learning\/learning-need"/,
    );
    expect(router).toMatch(
      /import type \{ WeaknessType \} from "@\/domain\/learning\/weakness\.types"/,
    );
    expect(router).not.toMatch(/import \{[^}]*LearningNeed/);
    expect(router).not.toMatch(/from "@\/domain\/learning\/student-lexeme-model"/);
  });

  it("does not write learner state when routing", () => {
    const decision = routeContextualMemory({
      target: {
        lexemeId: BUNDLED_SPOON_LEXEME_ID,
        senseId: MEAL_SENSE.spoon.senseId,
      },
      learningNeed: { lexemeId: BUNDLED_SPOON_LEXEME_ID, reason: "REVIEW_DUE" },
    });
    expect(decision.status).toBe("RESOLVED");
    expect(decision).not.toHaveProperty("snapshot");
    expect(decision).not.toHaveProperty("evidence");
  });
});
