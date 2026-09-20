import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = [
  "supabase/migrations/202609160001_vocabulary_domain.sql",
  "supabase/migrations/202609160002_learning_tasks.sql",
  "supabase/migrations/202609170001_game_sessions.sql",
  "supabase/migrations/202609170002_game_sessions_revision.sql",
  "supabase/migrations/202609170003_learning_evidence_session_correlation.sql",
  "supabase/migrations/202609170004_cleanup_progress_test_user.sql",
  "supabase/migrations/202609170005_vocabulary_placement_reviews.sql",
  "supabase/migrations/202609200001_context_lab_runs.sql",
]
  .map((file) => readFileSync(path.join(process.cwd(), file), "utf8"))
  .join("\n");

describe("Schema", () => {
  it("points learning_evidence.lexeme_id at lexemes(id)", () => {
    expect(sql).toMatch(/lexeme_id uuid not null references lexemes \(id\)/);
    expect(sql).toContain("create table if not exists lexemes");
    expect(sql).toContain("create table if not exists vocabulary_source_entries");
    expect(sql).not.toMatch(/word_id/);
  });

  it("keeps the append-only evidence trigger", () => {
    expect(sql).toContain("prevent_learning_evidence_mutation");
    expect(sql).toContain("learning_evidence_no_update");
    expect(sql).toContain("before update or delete on learning_evidence");
  });

  it("stores policy_version and canonical_key", () => {
    expect(sql).toContain("policy_version text not null");
    expect(sql).toContain("canonical_key text not null unique");
    expect(sql).toContain("related_lexeme_id uuid references lexemes (id)");
    expect(sql).toContain("distractor_lexeme_ids");
    expect(sql).toContain("selected_lexeme_id");
  });

  it("adds learning_tasks and evidence task_id with tag confidence checks", () => {
    expect(sql).toContain("create table if not exists learning_tasks");
    expect(sql).toMatch(/learning_evidence[\s\S]*task_id uuid references learning_tasks \(id\)/);
    expect(sql).toContain("lexeme_id uuid not null references lexemes (id)");
    expect(sql).toContain("lexeme_tags_topic_confidence_range");
    expect(sql).toContain("difficulty numeric not null check (difficulty >= 0 and difficulty <= 1)");
    expect(sql).toContain("prevent_learning_evidence_mutation");
    expect(sql).toContain("INDEPENDENT_CORRECT");
    expect(sql).toContain("hint_count = 0");
  });

  it("adds generic game_sessions orchestration without ranger_trial learning tables", () => {
    expect(sql).toContain("create table if not exists game_sessions");
    expect(sql).toContain("game_type text not null");
    expect(sql).toContain("state jsonb not null");
    expect(sql).toContain("game_sessions_user_id_idx");
    expect(sql).toContain("game_sessions_game_type_idx");
    expect(sql).toContain("game_sessions_updated_at_idx");
    expect(sql).not.toContain("ranger_trial_answers");
    expect(sql).not.toContain("ranger_trial_weak_words");
    expect(sql).not.toContain("ranger_trial_mastery");
  });

  it("adds game_sessions.revision as an optimistic concurrency token", () => {
    expect(sql).toContain("add column if not exists revision bigint not null default 0");
    expect(sql).toContain("game_sessions_revision_nonnegative");
    expect(sql).toContain("check (revision >= 0)");
  });

  it("does not require learning_sessions for evidence session_id", () => {
    expect(sql).toContain("drop constraint if exists learning_evidence_session_id_fkey");
  });

  it("adds a test-user-only evidence cleanup RPC without dropping append-only", () => {
    expect(sql).toContain("create or replace function cleanup_progress_test_user(target_user uuid)");
    expect(sql).toContain(
      "cleanup_progress_test_user refuses the V1 placeholder student user",
    );
    expect(sql).toContain("00000000-0000-4000-8000-000000000001");
    expect(sql).toContain("delete from learning_evidence where user_id = target_user");
    expect(sql).toContain("delete from learning_tasks where user_id = target_user");
    expect(sql).toMatch(
      /delete from learning_evidence[\s\S]*delete from learning_tasks/,
    );
    expect(sql).toContain("session_replication_role");
    expect(sql).toContain(
      "revoke all on function cleanup_progress_test_user(uuid) from public",
    );
    expect(sql).toContain(
      "revoke all on function cleanup_progress_test_user(uuid) from anon",
    );
    expect(sql).toContain(
      "grant execute on function cleanup_progress_test_user(uuid) to service_role",
    );
    expect(sql).toContain("before update or delete on learning_evidence");
  });

  it("adds vocabulary_placement_reviews as service-role reference data keyed by lexemes.id", () => {
    expect(sql).toContain("create table if not exists vocabulary_placement_reviews");
    expect(sql).toMatch(/lexeme_id uuid primary key references lexemes \(id\)/);
    expect(sql).toContain("enable row level security");
    expect(sql).toContain(
      "revoke all on table vocabulary_placement_reviews from anon",
    );
    expect(sql).toContain(
      "grant select, insert, update on table vocabulary_placement_reviews to service_role",
    );
    expect(sql).not.toMatch(
      /create policy[\s\S]*vocabulary_placement_reviews/,
    );
  });

  it("adds experimental context_lab_runs orchestration without learning-truth columns", () => {
    expect(sql).toContain("create table if not exists context_lab_runs");
    expect(sql).toContain("run_state jsonb not null");
    expect(sql).toContain("context_lab_runs_revision_nonnegative");
    expect(sql).toContain("context_lab_runs_id_user_id_idx");
    expect(sql).toContain("grant select, insert, update on table context_lab_runs to service_role");
    expect(sql).toContain("revoke all on table context_lab_runs from anon");
    expect(sql).not.toMatch(/context_lab_runs[\s\S]*answer_key/);
    expect(sql).not.toMatch(/context_lab_runs[\s\S]*mastery/);
    expect(sql).not.toMatch(/context_lab_runs[\s\S]*learning_evidence/);
    expect(sql).not.toMatch(/create policy[\s\S]*context_lab_runs/);
  });
});
