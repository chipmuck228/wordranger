import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_GATE_B_IMPORT_INCIDENT.md";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const AUTHORIZED_HEAD = "1418efb19a84332cca77384a7c4a11a691862c11";
const BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

describe("dedicated baseline V0 Gate B import incident", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");

  it("locks the unsuccessful import classification without secrets", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("Local incident record of one unsuccessful");
    expect(text).toContain("GATE_B_IMPORT_NOT_CLEANLY_COMPLETED");
    expect(text).toContain("NO_RETRY_DELETE_OR_REPAIR_PERFORMED");
    expect(text).toContain("LEARNER_WRITES_NOT_AUTHORIZED");
    expect(text).toContain("IMPORT_ROLLED_BACK_OR_NO_ROWS");
    expect(text).toContain("IMPORT_EXIT_NONZERO");
    expect(text).toContain("PR_17_REMAINS_UNMERGED");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(AUTHORIZED_HEAD);
    expect(text).toContain(BASELINE);
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(text).toContain(BASELINE_SHA256);
    expect(text).toContain("vocabulary-content-v1");
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("DEDICATED_API_AND_DB_MATCH");
    expect(text).toContain("SERVICE_ROLE_SNAPSHOT_MATCH");
    expect(text).toContain("LEGACY_SOURCE_EXCLUDED");
    expect(text).toContain("COMPLETE");
    expect(text).toContain("ALL_VOCABULARY_TABLES_ZERO_ROWS");
    expect(text).toContain("ALL_LEARNER_TABLES_ZERO_ROWS");
    expect(text).toContain("VOCAB_SERVICE_ROLE_SUI_NO_DELETE");
    expect(text).toContain("apply was not retried");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("WORKTREE_REMOVED");
    expect(text).not.toContain("GATE_B_VOCABULARY_IMPORTED");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/PR #17 was merged/i);
    expect(text).not.toMatch(/Gate C\/D were authorized/i);
  });

  it("locks the sanitized apply channel and explicit non-claims", () => {
    expect(text).toContain(
      "./node_modules/.bin/tsx scripts/import-vocabulary.ts --apply",
    );
    expect(text).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(text).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(text).toContain("Anon key was not passed");
    expect(text).toContain("Vocabulary was not imported.");
    expect(text).toContain("Learner data was not written.");
    expect(text).toContain("`/train` was not started.");
    expect(text).toContain("Runtime has not been accepted.");
    expect(text).toContain("PR #17 was not merged.");
    expect(text).toContain("Gate C/D remain unauthorized.");
    expect(text).toContain("does not authorize a retry");
  });
});
