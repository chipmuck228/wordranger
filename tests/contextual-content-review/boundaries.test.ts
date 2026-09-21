import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

describe("Content review boundaries", () => {
  it("does not import evaluator, Evidence, or learner mutation", () => {
    const files = walk("src/server/contextual-content-review");
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/processEvidence|submitTaskAction|default-task-evaluator/);
      expect(source, file).not.toMatch(/LearningEvidence|StudentLexemeModel/);
    }
    const bar = readFileSync(
      "src/app/debug/contextual-content-review/review-decision-bar.tsx",
      "utf8",
    );
    expect(bar).not.toMatch(/<input[\s\S]*fingerprint/);
    expect(bar).toContain("review-confirm-fingerprint");
    const actions = readFileSync(
      "src/app/debug/contextual-content-review/actions.ts",
      "utf8",
    );
    expect(actions).not.toContain("userId");
    expect(actions).not.toContain("registry status");
    expect(actions).not.toContain("pack path");
    expect(actions).toContain("fingerprint");
    expect(actions).toContain("revision");
    expect(actions).not.toContain("expectedFingerprint");
  });

  it("does not wire /train, Context Lab runs, or migrations", () => {
    const reviewApp = walk("src/app/debug/contextual-content-review");
    for (const file of reviewApp) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain('href="/train"');
      expect(source, file).not.toContain("startMealContextLab");
      expect(source, file).not.toContain("createExperienceRun");
    }
    const migrations = readdirSync("supabase/migrations");
    expect(migrations.some((name) => name.includes("content-review"))).toBe(false);
  });
});
