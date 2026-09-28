import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_TRANSACTIONAL_DIRECT_POSTGRES_REMOTE_PREFLIGHT_EVIDENCE.md";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const INSPECTED_HEAD = "edd6e247680742f9845bca7091068ccd1ef5ca0b";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";
const BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

describe("dedicated transactional direct-Postgres remote preflight evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");

  it("locks the remote preflight stop without authorizing import", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("one authorized");
    expect(text).toContain("read-only direct-Postgres preflight");
    expect(text).toContain("This is not a remote vocabulary import");
    expect(text).toContain(INSPECTED_HEAD);
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain(BASELINE_SHA256);
    expect(text).toContain("REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED");
    expect(text).toContain("DEDICATED_SNAPSHOT_ELIGIBLE");
    expect(text).toContain("DEDICATED_API_AND_DB_MATCH");
    expect(text).toContain("LEGACY_SOURCE_EXCLUDED");
    expect(text).toContain("POOLED_TRANSACTION_QUERY_REJECTED");
    expect(text).toContain("SQL_NOT_ATTEMPTED");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("READONLY_PREFLIGHT_COMPLETE");
    expect(text).toContain("LOCAL_DRY_RUN_ROLLED_BACK");
    expect(text).not.toContain("VOCABULARY_IMPORT_APPLIED");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(/lcjysnyb/i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(
      sha256("supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql"),
    ).toBe(BASELINE_SHA256);
  });
});
