import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_GATE_B_RETRY_APPLY_EVIDENCE.md";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const AUTHORIZED_HEAD = "db6cc6552b280f7b137d88e28888f000cc9aa2db";
const FIRST_ATTEMPT_HEAD = "1418efb19a84332cca77384a7c4a11a691862c11";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";

const LOCKED_SHA256 = {
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql":
    "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe",
  "scripts/import-vocabulary.ts":
    "6c3a1beb3d7ca80a50db5ab050cea86faea8a11ad6c7f509730d79efcfedc4f8",
  "src/server/vocabulary/import/run-cli.ts":
    "0816fd43c8506656dde05ed943f9aaab6a7d208511cc1ba65c7d3701d244af36",
  "src/server/vocabulary/import/apply-import.ts":
    "22ec38aa8a0ac163c56503470662eb652c71621e535d7cb426a7bc0cbafef74f",
  "src/server/vocabulary/import/batch-error.ts":
    "70a088d0a096593bc4f407606eb080344539d82f8a8014066e256627cc8d6c01",
  "src/server/vocabulary/import/import-rows.ts":
    "44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36",
  "src/server/vocabulary/import/rebuild-contract.ts":
    "b39ea86209bee55c7659a3ad1f4261bb708ed23fd9d104cf120f07b63ea825cb",
  "src/server/vocabulary/import/plan-import.ts":
    "63bca2c8a7f265da69fd03c8a455b7d10827cce1f702ca906efbd4a8cbc00b08",
  "data/vocabulary/source/words-source.json":
    "f47afc841ffd5a9b5643499f38e158dd72481d4ad7bd0b7f12fa0ab87f1ed142",
  "data/vocabulary/canonical/words-canonical.json":
    "5dbbfd77aed165d55000746a45762615316ee43814045756f6d7ca9722e77910",
  "data/vocabulary/enrichment/word-relations.json":
    "99d30f16662ff0ca609b5bc546d103d2479ab7035f558b98cb35d405a072f0e9",
  "data/vocabulary/enrichment/word-tags.json":
    "a0555ed0bbd0f132f39efaf20827de18d8250d16773f0c4dd2946f0e60296b0e",
} as const;

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

describe("dedicated baseline V0 Gate B retry apply evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");

  it("locks authorized retry head versus later evidence wording", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain(
      "Local evidence record of one authorized remote Gate B vocabulary import retry.",
    );
    expect(text).toContain("This is not a successful import and not a runtime acceptance.");
    expect(text).toContain("The authorized retry used isolated worktree head");
    expect(text).toContain(`\`${AUTHORIZED_HEAD}\``);
    expect(text).toContain("This evidence commit is a later local record.");
    expect(text).toContain("It is not the authorized retry head.");
    expect(text).toContain(
      "This was the second total remote `--apply` attempt against Dedicated",
    );
    expect(text).toContain("the first explicitly authorized Gate B retry");
    expect(text).toContain(FIRST_ATTEMPT_HEAD);
    expect(text).toContain("This task did not execute a second retry.");
    expect(text).toContain("This task performed exactly one `--apply`.");
    expect(text).toContain("GATE_B_RETRY_NOT_CLEANLY_COMPLETED");
    expect(text).toContain("NO_SECOND_RETRY_DELETE_OR_REPAIR_PERFORMED");
    expect(text).toContain("IMPORT_ROLLED_BACK_OR_NO_ROWS");
    expect(text).toContain("IMPORT_EXIT_NONZERO");
    expect(text).toContain("LEARNER_TABLES_REMAIN_EMPTY");
    expect(text).toContain("PR_17_REMAINS_UNMERGED");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("DEDICATED_API_AND_DB_MATCH");
    expect(text).toContain("SERVICE_ROLE_SNAPSHOT_MATCH");
    expect(text).toContain("LEGACY_SOURCE_EXCLUDED");
    expect(text).toContain("COMPLETE");
    expect(text).toContain("ALL_VOCABULARY_TABLES_ZERO_ROWS");
    expect(text).toContain("ALL_LEARNER_TABLES_ZERO_ROWS");
    expect(text).toContain("VOCAB_SERVICE_ROLE_SUI_NO_DELETE");
    expect(text).toContain("POSTGREST_READ_OK");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("WORKTREE_REMOVED");
    expect(text).not.toContain("GATE_B_VOCABULARY_IMPORTED");
    expect(text).toContain("This is not `PARTIAL_IMPORT_STATE`.");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/PR #17 was merged/i);
    expect(text).not.toMatch(/Gate C\/D were authorized/i);
  });

  it("locks importer and content identity hashes from the retry record", () => {
    for (const [file, expected] of Object.entries(LOCKED_SHA256)) {
      expect(text, file).toContain(expected);
      if (file === "src/server/vocabulary/import/batch-error.ts") {
        continue;
      }
      expect(sha256(file), file).toBe(expected);
    }
  });

  it("locks the sanitized retry result without authorizing another apply", () => {
    expect(text).toContain(
      "./node_modules/.bin/tsx scripts/import-vocabulary.ts --apply",
    );
    expect(text).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(text).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(text).toContain("Anon key was not passed");
    expect(text).toContain("VOCABULARY_IMPORT_BATCH_FAILED");
    expect(text).toContain("SOURCE_ENTRIES_UPSERT");
    expect(text).toContain("vocabulary_source_entries");
    expect(text).toContain("batchStart");
    expect(text).toContain("`0`");
    expect(text).toContain("batchSize");
    expect(text).toContain("`200`");
    expect(text).toContain("POSTGREST_ERROR");
    expect(text).toContain("providerCode");
    expect(text).toContain("The apply was not retried a second time.");
    expect(text).toContain("Remote content fingerprint was not computed because no rows exist");
    expect(text).toContain("This is not `COMPLETE`.");
    expect(text).toContain("Vocabulary was not imported.");
    expect(text).toContain("Learner data was not written.");
    expect(text).toContain("`/train` was not started.");
    expect(text).toContain("Runtime has not been accepted.");
    expect(text).toContain("PR #17 was not merged.");
    expect(text).toContain("Gate C/D remain unauthorized.");
    expect(text).toContain("does not authorize another retry");
  });
});
