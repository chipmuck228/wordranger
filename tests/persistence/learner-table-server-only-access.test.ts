import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FILE =
  "supabase/migrations_archive/pre_dedicated_baseline/202609250001_learner_table_server_only_access.sql";
const LEARNER_TABLES = [
  "game_sessions",
  "learning_tasks",
  "learning_evidence",
  "student_lexeme_models",
  "student_lexeme_skill_states",
  "student_lexeme_weaknesses",
] as const;
const QUALIFIED = LEARNER_TABLES.map((table) => `public.${table}`);
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
  "execute format",
  "execute immediate",
];

function executableLines(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.replace(/--.*$/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.toLowerCase());
}

function tableRefs(line: string): string[] {
  return [
    ...line.matchAll(
      /\b(?:alter table|on table|comment on table)\s+((?:public\.)?[a-z_][a-z0-9_]*)/g,
    ),
  ].map((match) => match[1]);
}

describe("learner table server-only access migration", () => {
  const sql = readFileSync(path.join(process.cwd(), FILE), "utf8");
  const lines = executableLines(sql);

  it("schema-qualifies every ALTER/REVOKE/GRANT on the six learner tables", () => {
    const privilege = lines.filter((line) =>
      /^(alter table|revoke all on table|grant )\b/.test(line),
    );
    expect(privilege.length).toBe(30);
    for (const table of LEARNER_TABLES) {
      const qualified = `public.${table}`;
      expect(privilege).toContain(
        `alter table ${qualified} enable row level security;`,
      );
      expect(privilege).toContain(`revoke all on table ${qualified} from public;`);
      expect(privilege).toContain(`revoke all on table ${qualified} from anon;`);
      expect(privilege).toContain(
        `revoke all on table ${qualified} from authenticated;`,
      );
      expect(privilege).toContain(
        `grant select, insert, update, delete on table ${qualified} to service_role;`,
      );
      expect(privilege.some((line) => line.includes(`table ${table} `))).toBe(
        false,
      );
    }
    for (const line of privilege) {
      const refs = tableRefs(line);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(QUALIFIED, ref).toContain(ref);
      }
    }
  });

  it("wraps privilege changes in an explicit transaction", () => {
    const begin = lines.indexOf("begin;");
    const commit = lines.indexOf("commit;");
    expect(begin).toBe(0);
    expect(commit).toBe(lines.length - 1);
    expect(commit).toBeGreaterThan(begin);
    const body = lines.slice(begin + 1, commit);
    expect(body.every((line) => /^(alter table|revoke all on table|grant )\b/.test(line))).toBe(
      true,
    );
    expect(body.some((line) => line.startsWith("alter table"))).toBe(true);
    expect(body.some((line) => line.startsWith("revoke all on table"))).toBe(true);
    expect(body.some((line) => line.startsWith("grant "))).toBe(true);
  });

  it("does not write deployment status or unqualified table comments", () => {
    expect(lines.some((line) => line.startsWith("comment on"))).toBe(false);
    expect(sql).not.toMatch(/not applied remotely until an authorized migrate/i);
  });

  it("does not reference shared blaze objects, secrets, or dynamic catalog scans", () => {
    const statements = lines.join("\n");
    for (const token of FORBIDDEN) {
      expect(statements, token).not.toContain(token);
    }
    expect(statements).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(statements).not.toMatch(/lcjysnyb|project.ref|service_role_key/i);
    expect(statements).not.toMatch(/\bdo\s+\$\$|\bexecute\b|\bformat\s*\(/i);
  });

  it("names only the explicit public learner tables", () => {
    const refs = lines.flatMap(tableRefs);
    expect(new Set(refs)).toEqual(new Set(QUALIFIED));
  });

  it("stays archived and is not applied by package scripts", () => {
    const active = readdirSync(path.join(process.cwd(), "supabase/migrations"));
    const archived = readdirSync(
      path.join(
        process.cwd(),
        "supabase/migrations_archive/pre_dedicated_baseline",
      ),
    );
    expect(active).not.toContain(
      "202609250001_learner_table_server_only_access.sql",
    );
    expect(archived).toContain(
      "202609250001_learner_table_server_only_access.sql",
    );
    const pkg = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    expect(pkg).not.toContain("supabase db push");
    expect(pkg).not.toContain("migration up");
  });
});
