import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === ".next") {
      return [];
    }
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("Free Practice security hardening boundaries", () => {
  it("does not add a second evaluator or processEvidence", () => {
    const hardening = walk("src/server/free-practice");
    for (const file of hardening) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/class \w*TaskEvaluator/);
      expect(source, file).not.toContain("function processEvidence");
    }
    expect(readFileSync("src/domain/tasks/default-task-evaluator.ts", "utf8")).toContain(
      "export class DefaultTaskEvaluator",
    );
  });

  it("keeps answer_key and the task repository off the client surface", () => {
    const clientFiles = [
      "src/app/practice/free-practice-client.tsx",
      "src/components/free-practice/free-practice-session-storage.ts",
      "src/server/home/resolve-home-learning-paths.ts",
    ];
    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("supabase-learning-task-repository");
      expect(source, file).not.toContain("getTaskForEvaluation");
      expect(source, file).not.toContain("answer_key");
    }
    const home = readFileSync("src/server/home/resolve-home-learning-paths.ts", "utf8");
    expect(home).toContain('"/train"');
    expect(home).not.toContain("/practice");
  });

  it("does not let the browser choose userId or session owner", () => {
    const actions = readFileSync("src/app/practice/actions.ts", "utf8");
    expect(actions).not.toContain("userId");
    expect(actions).not.toContain("ownerId");
    const page = readFileSync("src/app/practice/page.tsx", "utf8");
    expect(page).toContain("isFreePracticePageAvailable");
  });
});
