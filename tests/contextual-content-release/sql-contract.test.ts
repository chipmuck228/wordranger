import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations_archive/pre_dedicated_baseline/202609220002_contextual_content_active_releases.sql"),
  "utf8",
);

describe("contextual content release SQL contract", () => {
  it("requires row columns and manifest lifecycle fields to stay equal", () => {
    expect(sql).toContain("contextual_content_releases_row_manifest_parity");
    expect(sql).toContain("release_id is not distinct from manifest->>'releaseId'");
    expect(sql).toContain("status is not distinct from manifest->>'status'");
    expect(sql).toContain("revision is not distinct from (manifest->>'revision')::bigint");
    expect(sql).toContain("published_at is not distinct from (nullif(manifest->>'publishedAt', ''))::timestamptz");
    expect(sql).toContain("superseded_by_release_id is not distinct from nullif(manifest->>'supersededByReleaseId', '')");
  });

  it("publish RPC writes row status/revision and manifest status/revision together", () => {
    expect(sql).toContain("jsonb_set(final_manifest, '{status}', to_jsonb('PUBLISHED'::text), true)");
    expect(sql).toContain("jsonb_set(final_manifest, '{revision}', to_jsonb(next_revision), true)");
    expect(sql).toContain("status = 'PUBLISHED'");
    expect(sql).toContain("revision = next_revision");
    expect(sql).toContain("manifest = final_manifest");
    expect(sql).toContain("jsonb_set(supersede_manifest, '{status}', to_jsonb('SUPERSEDED'::text), true)");
    expect(sql).toContain("jsonb_set(supersede_manifest, '{revision}', to_jsonb(next_supersede_revision), true)");
  });

  it("rollback RPC restores row status/revision and manifest status/revision together", () => {
    expect(sql).toContain("jsonb_set(restored_manifest, '{status}', to_jsonb('PUBLISHED'::text), true)");
    expect(sql).toContain("jsonb_set(restored_manifest, '{revision}', to_jsonb(next_target_revision), true)");
    expect(sql).toContain("revision = next_target_revision");
    expect(sql).toContain("manifest = restored_manifest");
    expect(sql).toContain("jsonb_set(outgoing_manifest, '{status}', to_jsonb('SUPERSEDED'::text), true)");
  });

  it("does not persist the caller JSON as the final published manifest", () => {
    expect(sql).not.toMatch(/manifest = p_published_manifest/);
    expect(sql).not.toMatch(/manifest = p_supersede_manifest/);
    expect(sql).toContain("final_manifest := current_row.manifest");
  });
});
