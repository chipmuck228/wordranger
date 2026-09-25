import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FILE = "supabase/migrations/202609250001_learner_table_server_only_access.sql";
const LEARNER_TABLES = [
  "game_sessions",
  "learning_tasks",
  "learning_evidence",
  "student_lexeme_models",
  "student_lexeme_skill_states",
  "student_lexeme_weaknesses",
] as const;
const FORBIDDEN = [
  "campus",
  "enrollment",
  "newsletter",
  "stripe",
  "v2_",
  "v3_",
  "information_schema",
  "pg_catalog",
  "create policy",
  "force row level security",
];

describe("learner table server-only access migration", () => {
  const sql = readFileSync(path.join(process.cwd(), FILE), "utf8");

  it("enables RLS and revokes client CRUD on the six learner tables only", () => {
    for (const table of LEARNER_TABLES) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`revoke all on table ${table} from anon`);
      expect(sql).toContain(`revoke all on table ${table} from authenticated`);
      expect(sql).toContain(
        `grant select, insert, update, delete on table ${table} to service_role`,
      );
    }
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/force row level security/i);
  });

  it("does not reference shared blaze objects, secrets, or dynamic catalog scans", () => {
    const statements = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .toLowerCase();
    for (const token of FORBIDDEN) {
      expect(statements, token).not.toContain(token);
    }
    expect(sql).not.toMatch(/supabase\.co|eyJ|postgres:\/\//i);
    expect(sql).not.toMatch(/lcjysnyb|project.ref|service_role_key/i);
  });

  it("does not name any table outside the explicit learner list", () => {
    const named = [...sql.matchAll(/on table ([a-z_]+)/g)].map((m) => m[1]);
    const altered = [...sql.matchAll(/alter table ([a-z_]+)/g)].map((m) => m[1]);
    for (const name of [...named, ...altered]) {
      expect(LEARNER_TABLES, name).toContain(name);
    }
  });

  it("is the only new learner-hardening file and is not applied by package scripts", () => {
    const names = readdirSync(path.join(process.cwd(), "supabase/migrations"));
    expect(names).toContain("202609250001_learner_table_server_only_access.sql");
    const pkg = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    expect(pkg).not.toContain("supabase db push");
    expect(pkg).not.toContain("migration up");
  });
});
