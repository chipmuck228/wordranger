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

const PLANNING_DIR = join(process.cwd(), "src/server/free-practice/planning");
const CLIENT_DIRS = [
  join(process.cwd(), "src/components"),
  join(process.cwd(), "src/app"),
];

const FORBIDDEN_IMPORTS = [
  "planLearningSession",
  "DeterministicScheduler",
  "DefaultLearningNeedGenerator",
  "DefaultTaskGenerator",
  "submitTaskAction",
  "processEvidence",
  "createLearningEvidenceFromTaskEvaluation",
];

const PLANNER_TOKENS = [
  "planFreePractice",
  "free-practice/planning",
  "SupabaseFreePracticePlanReadAdapter",
  "InMemoryFreePracticePlanReadAdapter",
];

describe("Free Practice planning architecture boundary", () => {
  it("keeps every planning module server-only", () => {
    for (const file of walk(PLANNING_DIR)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toMatch(/import ["']server-only["']/);
      for (const token of FORBIDDEN_IMPORTS) {
        expect(text, `${file} ${token}`).not.toContain(token);
      }
      expect(text, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("does not let Client Components import the planner or read adapter", () => {
    for (const dir of CLIENT_DIRS) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        if (!text.includes("\"use client\"") && !text.includes("'use client'")) {
          continue;
        }
        for (const token of PLANNER_TOKENS) {
          expect(text, `${file} ${token}`).not.toContain(token);
        }
      }
    }
  });

  it("is not imported by student UI, /train, or Context Lab", () => {
    const surfaces = [
      join(process.cwd(), "src/components"),
      join(process.cwd(), "src/app/train"),
      join(process.cwd(), "src/app/play"),
      join(process.cwd(), "src/components/home"),
      join(process.cwd(), "src/server/context-lab"),
    ];
    for (const dir of surfaces) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        for (const token of PLANNER_TOKENS) {
          expect(text, `${file} ${token}`).not.toContain(token);
        }
      }
    }
  });

  it("does not change the frozen LearningRepository interface", () => {
    const repo = readFileSync(
      join(process.cwd(), "src/domain/learning/learning-repository.ts"),
      "utf8",
    );
    expect(repo).not.toContain("listRecentTerminalEvidence");
    expect(repo).not.toContain("FreePractice");
    expect(repo).toContain("getEvidenceForLexeme");
    expect(repo).toContain("commitEvidenceAndSnapshot");
  });

  it("keeps Homepage unwired while /practice exists as a gated Candidate surface", () => {
    const appFiles = walk(join(process.cwd(), "src/app"));
    expect(appFiles.some((file) => file.includes("/practice/page.tsx"))).toBe(
      true,
    );
    const home = readFileSync(
      join(process.cwd(), "src/components/home/home-page.tsx"),
      "utf8",
    );
    expect(home).not.toContain("planFreePractice");
    expect(home).not.toContain("FREE_PRACTICE");
    expect(home).not.toContain("/practice");
  });
});
