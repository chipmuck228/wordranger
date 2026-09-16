import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/202609160001_vocabulary_domain.sql",
  ),
  "utf8",
);

describe("Phase 02 schema", () => {
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
});
