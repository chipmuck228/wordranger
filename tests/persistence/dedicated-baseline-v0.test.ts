import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ACTIVE_DIR = "supabase/migrations";
const ARCHIVE_DIR = "supabase/migrations_archive/pre_dedicated_baseline";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const ARCHIVE_README =
  "supabase/migrations_archive/pre_dedicated_baseline/README.md";

const LEARNER_TABLES = [
  "learning_tasks",
  "game_sessions",
  "learning_evidence",
  "student_lexeme_models",
  "student_lexeme_skill_states",
  "student_lexeme_weaknesses",
] as const;

const REQUIRED_TABLES = [
  "vocabulary_source_entries",
  "lexemes",
  "lexeme_relations",
  "lexeme_tags",
  ...LEARNER_TABLES,
] as const;

const EXCLUDED = [
  "cleanup_progress_test_user",
  "vocabulary_placement_reviews",
  "context_lab_runs",
  "contextual_content_releases",
  "contextual_content_active_release_pointers",
  "contextual_content_batch_promotions",
  "learning_sessions",
  "campus",
  "enrollment",
  "newsletter",
  "traffic",
  "public.users",
  "v3_migration_offering_legacy_stage",
] as const;

const ADAPTERS = [
  "src/server/learning/supabase-learning-repository.ts",
  "src/server/tasks/supabase-learning-task-repository.ts",
  "src/server/game-session/supabase-game-session-store.ts",
  "src/server/training/supabase-daily-training-session-store.ts",
  "src/server/free-practice/session/supabase-store.ts",
  "src/server/scheduler/supabase-learning-state-query-repository.ts",
  "src/server/free-practice/planning/supabase-plan-read-adapter.ts",
] as const;

const V0_DOCS = [
  "docs/DEDICATED_WORDRANGER_CONSOLIDATED_BASELINE_CANDIDATE_V0.md",
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_OBJECT_MANIFEST.md",
] as const;

const baseline = readFileSync(path.join(process.cwd(), BASELINE), "utf8");
const archiveReadme = readFileSync(
  path.join(process.cwd(), ARCHIVE_README),
  "utf8",
);

function sqlFiles(dir: string): string[] {
  return readdirSync(path.join(process.cwd(), dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

describe("dedicated WordRanger consolidated baseline V0", () => {
  it("keeps a single active lineage file", () => {
    expect(sqlFiles(ACTIVE_DIR)).toEqual([
      "202609260001_dedicated_wordranger_baseline_v0.sql",
    ]);
    expect(sqlFiles(ARCHIVE_DIR)).toHaveLength(12);
    expect(archiveReadme).toContain("not** an active Supabase CLI migration");
    expect(archiveReadme).toContain(BASELINE);
  });

  it("does not treat the archive directory as active migrations", () => {
    expect(ARCHIVE_DIR.startsWith("supabase/migrations/")).toBe(false);
    expect(ARCHIVE_DIR).toBe("supabase/migrations_archive/pre_dedicated_baseline");
    const pkg = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    expect(pkg).not.toContain("supabase db push");
    expect(pkg).not.toContain("migration up");
    expect(pkg).not.toContain("migrations_archive");
  });

  it("is a deterministic empty-database create, not a fake history replay", () => {
    expect(baseline).toMatch(/^begin;/m);
    expect(baseline).toMatch(/^commit;/m);
    expect(baseline).toContain("create extension if not exists pgcrypto");
    expect(baseline).not.toContain("if not exists public.");
    expect(baseline).not.toContain("create table if not exists");
    expect(baseline).not.toMatch(/insert into/i);
    expect(baseline).not.toContain("schema_migrations");
    expect(baseline).not.toMatch(/https?:\/\//i);
    expect(baseline).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(baseline).not.toMatch(/lcjysnyb|service_role_key|project.ref/i);
  });

  it("creates every required V0 object and the evidence correlation contract", () => {
    for (const table of REQUIRED_TABLES) {
      expect(baseline).toContain(`create table public.${table}`);
    }
    expect(baseline).toContain("lexeme_id uuid not null references public.lexemes (id)");
    expect(baseline).toContain("prevent_learning_evidence_mutation");
    expect(baseline).toContain("learning_evidence_no_update");
    expect(baseline).toContain("before update or delete on public.learning_evidence");
    expect(baseline).toContain("task_id uuid references public.learning_tasks (id)");
    expect(baseline).toContain("learning_evidence_task_id_uidx");
    expect(baseline).toContain("game_sessions_revision_nonnegative");
    expect(baseline).toContain("revision bigint not null default 0");
    expect(baseline).toContain("session_id uuid,");
    expect(baseline).not.toContain("references public.learning_sessions");
    expect(baseline).toContain("lexeme_tags_topic_confidence_range");
    expect(baseline).toContain("INDEPENDENT_CORRECT");
    expect(baseline).toContain("hint_count = 0");
  });

  it("inlines learner-table server-only grants without FORCE or client policies", () => {
    for (const table of LEARNER_TABLES) {
      const qualified = `public.${table}`;
      expect(baseline).toContain(
        `alter table ${qualified} enable row level security;`,
      );
      expect(baseline).toContain(`revoke all on table ${qualified} from public;`);
      expect(baseline).toContain(`revoke all on table ${qualified} from anon;`);
      expect(baseline).toContain(
        `revoke all on table ${qualified} from authenticated;`,
      );
      expect(baseline).toContain(
        `grant select, insert, update, delete on table ${qualified} to service_role;`,
      );
    }
    expect(baseline.toLowerCase()).not.toContain("force row level security");
    expect(baseline.toLowerCase()).not.toContain("create policy");
  });

  it("excludes shared Blaze, experimental, test-only, and unused stub objects", () => {
    for (const name of EXCLUDED) {
      expect(baseline, name).not.toContain(name);
    }
    expect(baseline).not.toMatch(/create or replace function cleanup_/i);
  });

  it("keeps V0 docs free of secrets, URLs, and remote-apply claims", () => {
    for (const file of V0_DOCS) {
      const text = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(text, file).toMatch(/Candidate \/ Not a Standard/);
      expect(text, file).not.toMatch(/https?:\/\//i);
      expect(text, file).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
      expect(text, file).not.toMatch(/lcjysnyb|service_role_key/i);
      expect(text, file).not.toMatch(/schema baseline applied/i);
      expect(text, file).not.toMatch(/learner rows imported/i);
    }
  });

  it("covers frozen student-path adapter columns", () => {
    for (const file of ADAPTERS) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toContain("learning_sessions");
      expect(source, file).not.toContain("cleanup_progress_test_user");
      expect(source, file).not.toContain("vocabulary_placement_reviews");
    }
    expect(baseline).toContain("answer_key jsonb not null");
    expect(baseline).toContain("public_payload jsonb not null");
    expect(baseline).toContain("policy_version text not null");
    expect(baseline).toContain("recent_performance jsonb not null");
    expect(baseline).toContain("related_lexeme_id uuid references public.lexemes (id)");
  });
});
