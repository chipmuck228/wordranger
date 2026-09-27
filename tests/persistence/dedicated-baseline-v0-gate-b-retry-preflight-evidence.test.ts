import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_GATE_B_RETRY_PREFLIGHT_EVIDENCE.md";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const SCRIPT = "scripts/import-vocabulary.ts";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const INSPECTED_HEAD = "d6da81039e51086f19a0d11c97e370777a56863f";
const BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const IMPORTER_SCRIPT_SHA256 =
  "6c3a1beb3d7ca80a50db5ab050cea86faea8a11ad6c7f509730d79efcfedc4f8";
const IMPORT_ROWS_SHA256 =
  "44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36";
const REBUILD_SHA256 =
  "b39ea86209bee55c7659a3ad1f4261bb708ed23fd9d104cf120f07b63ea825cb";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

describe("dedicated baseline V0 Gate B retry preflight evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");
  const script = readFileSync(path.join(process.cwd(), SCRIPT), "utf8");

  it("locks read-only preflight classifications without authorizing retry", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("This is not a Gate B retry and not a successful import.");
    expect(text).toContain("retry preflight");
    expect(text).toContain("HISTORICAL_OPAQUE_FAILURE_CAUSE_NOT_RECOVERABLE");
    expect(text).toContain("The original Gate B failure cause remains unknown.");
    expect(text).toContain("GATE_B_RETRY_PREFLIGHT_PASSED");
    expect(text).toContain("POSTGREST_READ_PATH_CONFIRMED");
    expect(text).toContain("RETRY_REQUIRES_SEPARATE_AUTHORIZATION");
    expect(text).toContain("PR_17_REMAINS_UNMERGED");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(INSPECTED_HEAD);
    expect(text).toContain(BASELINE);
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(text).toContain(BASELINE_SHA256);
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("DEDICATED_API_AND_DB_MATCH");
    expect(text).toContain("SERVICE_ROLE_SNAPSHOT_MATCH");
    expect(text).toContain("LEGACY_SOURCE_EXCLUDED");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("HISTORY_POSTCONDITION_VERIFIED");
    expect(text).toContain("COMPLETE");
    expect(text).toContain("ALL_REQUIRED_TABLES_ZERO_ROWS");
    expect(text).toContain("VOCAB_SERVICE_ROLE_SUI_NO_DELETE");
    expect(text).toContain("LEARNER_SERVICE_ROLE_DML_CLIENTS_DENIED");
    expect(text).toContain("SHARED_AND_OPTIONAL_OBJECTS_ABSENT");
    expect(text).toContain("POSTGREST_READ_OK");
    expect(text).toContain("vocabulary_source_entries");
    expect(text).toContain("lexeme_tags");
    expect(text).toContain("VOCABULARY_IMPORT_APPLIED");
    expect(text).toContain(IMPORTER_SCRIPT_SHA256);
    expect(text).toContain(IMPORT_ROWS_SHA256);
    expect(text).toContain(REBUILD_SHA256);
    expect(sha256(SCRIPT)).toBe(IMPORTER_SCRIPT_SHA256);
    expect(script).toContain("createSupabaseServiceRoleClient");
    expect(script).not.toContain("createSupabaseServerClient");
    expect(text).not.toContain("GATE_B_VOCABULARY_IMPORTED");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/PR #17 was merged/i);
    expect(text).not.toMatch(/this document authorizes retry/i);
    expect(text).not.toMatch(/Gate B was retried/i);
  });

  it("locks current read-path success without claiming historical cause or retry", () => {
    expect(text).toContain("limit=0");
    expect(text).toContain("Current PostgREST `limit=0` success does not prove");
    expect(text).toContain("Gate B was not retried.");
    expect(text).toContain("`--apply` was not executed against Dedicated.");
    expect(text).toContain("Vocabulary remains unimported.");
    expect(text).toContain("Learner data was not written.");
    expect(text).toContain("`/train` was not started.");
    expect(text).toContain("PR #17 was not merged.");
    expect(text).toContain("Gate C/D remain unauthorized.");
    expect(text).toContain("createSupabaseServiceRoleClient");
    expect(text).toContain("SOURCE_ENTRIES_UPSERT");
    expect(text).toContain("LEXEMES_UPSERT");
    expect(text).toContain("LEXEME_ABBREVIATIONS_UPDATE");
    expect(text).toContain("RELATIONS_UPSERT");
    expect(text).toContain("TAGS_UPSERT");
  });
});
