import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

const SESSION_DIR = join(process.cwd(), "src/server/free-practice/session");
const FORBIDDEN = [
  "planLearningSession",
  "DeterministicScheduler",
  "DefaultLearningNeedGenerator",
  "submitTaskAction",
  "processEvidence",
  "DefaultTaskEvaluator",
  "createLearningEvidenceFromTaskEvaluation",
  "EvidenceFactory",
  "commitEvidenceAndSnapshot",
  "LearningRepository",
];

describe("Free Practice session architecture boundary", () => {
  it("keeps every session module server-only and frozen-boundary clean", () => {
    for (const file of walk(SESSION_DIR)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toMatch(/import ["']server-only["']/);
      for (const token of FORBIDDEN) {
        expect(text, `${file} ${token}`).not.toContain(token);
      }
      expect(text, file).not.toContain("@/server/context-lab");
    }
  });

  it("limits DefaultTaskGenerator and the projection to the controller", () => {
    for (const file of walk(SESSION_DIR)) {
      const text = readFileSync(file, "utf8");
      const base = file.split("/").pop();
      if (base === "controller.ts") {
        expect(text).toContain("DefaultTaskGenerator");
        expect(text).toContain("toTaskGenerationProjection");
        continue;
      }
      if (base === "to-task-generation-projection.ts") {
        expect(text).toContain("toTaskGenerationProjection");
        expect(text).not.toContain("DefaultTaskGenerator");
        continue;
      }
      expect(text, file).not.toContain("DefaultTaskGenerator");
      expect(text, file).not.toContain("toTaskGenerationProjection");
    }
    const index = readFileSync(join(SESSION_DIR, "index.ts"), "utf8");
    expect(index).not.toContain("toTaskGenerationProjection");
  });

  it("is not imported by student UI, /train, Homepage, or Context Lab", () => {
    const surfaces = [
      join(process.cwd(), "src/components"),
      join(process.cwd(), "src/app/train"),
      join(process.cwd(), "src/app/play"),
      join(process.cwd(), "src/server/context-lab"),
    ];
    for (const dir of surfaces) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        expect(text, file).not.toContain("free-practice/session");
        expect(text, file).not.toContain("FreePracticeSessionController");
      }
    }
  });

  it("does not add a /practice route or Homepage wiring", () => {
    const appFiles = walk(join(process.cwd(), "src/app"));
    expect(appFiles.some((file) => file.includes("/practice"))).toBe(false);
    const home = readFileSync(
      join(process.cwd(), "src/components/home/home-page.tsx"),
      "utf8",
    );
    expect(home).not.toContain("FreePracticeSessionController");
    expect(home).not.toContain("FREE_PRACTICE");
  });
});
