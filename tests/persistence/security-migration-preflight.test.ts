import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION =
  "supabase/migrations_archive/pre_dedicated_baseline/202609250001_learner_table_server_only_access.sql";
const PREFLIGHT =
  "docs/FREE_PRACTICE_SECURITY_MIGRATION_DEPLOYMENT_PREFLIGHT.md";
const TABLES = [
  "public.learning_tasks",
  "public.game_sessions",
  "public.learning_evidence",
  "public.student_lexeme_models",
  "public.student_lexeme_skill_states",
  "public.student_lexeme_weaknesses",
] as const;

describe("security migration deployment preflight", () => {
  const sql = readFileSync(path.join(process.cwd(), MIGRATION));
  const doc = readFileSync(path.join(process.cwd(), PREFLIGHT), "utf8");
  const sha = createHash("sha256").update(sql).digest("hex");

  it("pins the committed migration SHA-256 and six public tables", () => {
    expect(doc).toContain("68d113a08c53b8f87281e4cdaddf76fb51047324");
    expect(doc).toContain(sha);
    for (const table of TABLES) {
      expect(doc).toContain(table);
    }
    expect(doc).toContain("Pre-apply snapshot");
    expect(doc).toContain("NOT APPLIED");
    expect(doc).toContain("Dashboard SQL editor");
    expect(doc).toContain("begin;");
    expect(doc).toContain("FORCE RLS off");
    expect(doc).toMatch(/Current remote apply status: \*\*APPLIED\*\*/);
  });

  it("does not embed secrets or a second copy of the migration", () => {
    expect(doc).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(doc).not.toMatch(/service_role_key|lcjysnyb/i);
    expect(doc).not.toContain("alter table public.learning_tasks enable");
    expect(doc).toMatch(/Future `db push` remains \*\*forbidden\*\*/);
  });
});
