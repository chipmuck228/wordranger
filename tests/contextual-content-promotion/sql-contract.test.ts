import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/202609220003_contextual_content_batch_promotions.sql"),
  "utf8",
);

describe("contextual content batch promotion SQL contract", () => {
  it("keeps one row per scene+pack with row/record parity", () => {
    expect(sql).toContain("primary key (scene_id, pack_id)");
    expect(sql).toContain("contextual_content_batch_promotions_row_record_parity");
    expect(sql).toContain("scene_id is not distinct from record->>'sceneId'");
    expect(sql).toContain("pack_id is not distinct from record->>'packId'");
    expect(sql).toContain("revision is not distinct from (record->>'revision')::bigint");
    expect(sql).toContain("pack_fingerprint is not distinct from record->>'packFingerprint'");
    expect(sql).toContain("record->>'kind' = 'CONTEXTUAL_CONTENT_BATCH_PROMOTION'");
  });

  it("rejects learning-state keys and service-role-only writes", () => {
    expect(sql).toContain("contextual_content_batch_promotions_no_learning_state");
    expect(sql).toContain("not (record ? 'answerKey')");
    expect(sql).toContain("not (record ? 'LearningEvidence')");
    expect(sql).toContain("not (record ? 'StudentLexemeModel')");
    expect(sql).toContain("not (record ? 'score')");
    expect(sql).toContain("not (record ? 'mastery')");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table contextual_content_batch_promotions from anon");
    expect(sql).toContain("revoke all on table contextual_content_batch_promotions from authenticated");
    expect(sql).toContain("grant select, insert, update, delete on table contextual_content_batch_promotions to service_role");
    expect(sql).toContain("grant execute on function promote_contextual_content_batch");
  });

  it("does not persist the caller revision blindly", () => {
    expect(sql).toContain("next_revision := 1");
    expect(sql).toContain("next_revision := current_row.revision + 1");
    expect(sql).toContain("jsonb_set(p_record, '{revision}', to_jsonb(next_revision), true)");
    expect(sql).not.toMatch(/revision = p_expected_revision/);
  });
});
