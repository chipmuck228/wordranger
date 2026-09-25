import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const LEARNER_TABLES = [
  "game_sessions",
  "learning_tasks",
  "learning_evidence",
  "student_lexeme_models",
  "student_lexeme_skill_states",
  "student_lexeme_weaknesses",
] as const;

describe("Free Practice production-readiness audit contracts", () => {
  it("does not add anon or authenticated learner-table policies", () => {
    const dir = join(ROOT, "supabase/migrations");
    const sql = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(join(dir, name), "utf8"))
      .join("\n");
    for (const table of LEARNER_TABLES) {
      expect(sql, table).not.toMatch(
        new RegExp(`create policy .* on ${table}`, "i"),
      );
    }
  });

  it("has no supabase CLI project link or migration-history helper", () => {
    expect(existsSync(join(ROOT, "supabase/config.toml"))).toBe(false);
    const packageJson = read("package.json");
    expect(packageJson).not.toContain("supabase db push");
    expect(packageJson).not.toContain("migration up");
  });

  it("has no student login, anonymous mint, or cookie-refresh middleware", () => {
    expect(existsSync(join(ROOT, "src/middleware.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "middleware.ts"))).toBe(false);
    const srcFiles: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".next") {
          continue;
        }
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (full.endsWith(".ts") || full.endsWith(".tsx")) {
          srcFiles.push(readFileSync(full, "utf8"));
        }
      }
    };
    walk(join(ROOT, "src"));
    const joined = srcFiles.join("\n");
    expect(joined).not.toContain("signInAnonymously");
    expect(joined).not.toContain("signInWithPassword");
    expect(joined).not.toContain("signInWithOtp");
    expect(joined).not.toContain("auth/callback");
  });

  it("resolves Free Practice identity with cookie getUser and never accepts client userId", () => {
    const reader = read("src/server/free-practice/identity/supabase-session-reader.ts");
    const actions = read("src/app/practice/actions.ts");
    const home = read("src/server/home/resolve-home-learning-paths.ts");
    expect(reader).toContain("auth.getUser");
    expect(reader).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(reader).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(reader).not.toContain("getSession");
    expect(actions).not.toContain("userId");
    expect(home).toContain('"/train"');
    expect(home).not.toContain("/practice");
  });

  it("binds evaluation task reads to server user and session before answer_key", () => {
    const tasks = read("src/server/tasks/supabase-learning-task-repository.ts");
    const server = read("src/lib/supabase/server.ts");
    const getBody = tasks.slice(tasks.indexOf("getTaskForEvaluation"));
    expect(getBody).toContain('.eq("id", lookup.taskId)');
    expect(getBody).toContain('.eq("user_id", lookup.userId)');
    expect(getBody).toContain('.eq("session_id", lookup.sessionId)');
    expect(getBody).toContain("answer_key");
    expect(server).toContain("const key = serviceRoleKey ?? anonKey");
  });
});
