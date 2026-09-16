import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = [
  "supabase/migrations/202609160001_vocabulary_domain.sql",
  "supabase/migrations/202609160002_learning_tasks.sql",
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
});
