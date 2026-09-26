import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION =
  "supabase/migrations_archive/pre_dedicated_baseline/202609250001_learner_table_server_only_access.sql";
const EVIDENCE =
  "docs/FREE_PRACTICE_SECURITY_MIGRATION_APPLY_EVIDENCE.md";
const DATABASE = "docs/DATABASE.md";
const HARDENING = "docs/FREE_PRACTICE_PRODUCTION_SECURITY_HARDENING_1.md";
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

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

describe("security migration apply evidence", () => {
  const sql = readFileSync(path.join(process.cwd(), MIGRATION));
  const evidence = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");
  const database = readFileSync(path.join(process.cwd(), DATABASE), "utf8");
  const hardening = readFileSync(path.join(process.cwd(), HARDENING), "utf8");
  const preflight = readFileSync(path.join(process.cwd(), PREFLIGHT), "utf8");
  const sha = createHash("sha256").update(sql).digest("hex");

  it("references the exact migration SHA and all six tables", () => {
    expect(evidence).toContain(sha);
    expect(evidence).toContain(MIGRATION);
    for (const table of TABLES) {
      expect(evidence).toContain(table);
    }
    expect(evidence).toContain("PROJECT_MATCH");
    expect(evidence).toContain("TEMP_DELETED");
    expect(evidence).toContain("DENIED");
    expect(evidence).toContain("SESSION_NOT_FOUND");
  });

  it("does not embed URL, ref, key, token, answer_key, SQL, or UUIDs", () => {
    expect(evidence).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(evidence).not.toMatch(/service_role_key|lcjysnyb/i);
    expect(evidence).not.toContain("answer_key");
    expect(evidence).not.toContain("alter table public.learning_tasks enable");
    expect(evidence).not.toMatch(UUID_RE);
    expect(evidence).not.toContain("begin;");
  });

  it("records apply without claiming Free Practice is live", () => {
    expect(evidence).toMatch(/Success\. No rows returned/);
    expect(evidence).toContain("schema_migrations");
    expect(evidence).toMatch(/`db push`.+forbidden/);
    expect(evidence).toContain("/practice` remains disabled");
    expect(evidence).toContain("links to `/train`");
    expect(evidence).not.toMatch(/\/practice` is live/i);
    expect(evidence).not.toMatch(/Free Practice is live/i);
    expect(evidence).toContain("Candidate / not a Standard");
  });

  it("updates status docs so the migration is not currently unapplied", () => {
    expect(database).not.toContain("committed, not remotely applied");
    expect(hardening).not.toMatch(
      /Migration file is \*\*committed, not remotely applied\*\*/,
    );
    expect(preflight).not.toMatch(/^- Remote apply status: \*\*NOT APPLIED\*\*$/m);
    expect(database).toContain("authorized Dashboard SQL Editor");
    expect(hardening).toContain("authorized Dashboard SQL Editor");
    expect(preflight).toMatch(/Current remote apply status: \*\*APPLIED\*\*/);
  });

  it("keeps db push / history repair forbidden and /practice closed", () => {
    for (const doc of [evidence, database, hardening, preflight]) {
      expect(doc).toMatch(/db push/i);
      expect(doc).toMatch(/forbidden/i);
      expect(doc).toContain("/practice");
      expect(doc).not.toMatch(/\/practice` is enabled/i);
      expect(doc).not.toMatch(/production Free Practice is live/i);
    }
    expect(preflight).toMatch(/Future `db push` remains \*\*forbidden\*\*/);
    expect(preflight).toContain("history repair");
    expect(database).toContain("Migration history remains absent");
    expect(hardening).toContain("Migration history remains absent");
  });
});
