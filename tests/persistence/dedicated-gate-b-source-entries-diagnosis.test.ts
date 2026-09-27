import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

const EVIDENCE = "docs/DEDICATED_WORDRANGER_GATE_B_SOURCE_ENTRIES_DIAGNOSIS.md";
const INTEGRATION =
  "tests/persistence/dedicated-gate-b-source-entries-diagnosis.integration.test.ts";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const INSPECTED_HEAD = "db6cc6552b280f7b137d88e28888f000cc9aa2db";
const EVIDENCE_HEAD = "a6cd97997115ae6e0b914b41077e58fad1de0e9a";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const APPLY_IMPORT = "src/server/vocabulary/import/apply-import.ts";
const BATCH_ERROR = "src/server/vocabulary/import/batch-error.ts";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";

const LOCKED_SHA256 = {
  [BASELINE]:
    "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe",
  [APPLY_IMPORT]:
    "22ec38aa8a0ac163c56503470662eb652c71621e535d7cb426a7bc0cbafef74f",
  "src/server/vocabulary/import/import-rows.ts":
    "44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36",
  [BATCH_ERROR]:
    "f36361f763a04cc5682841bb1c856fc2cc130506d236f6216ebfb656091b807b",
} as const;

const IMPORTER_FIELDS = [
  "id",
  "canonical_key",
  "source_index",
  "section",
  "source_page_start",
  "source_page_end",
  "source_word_raw",
  "starred",
  "source_ipa_raw",
  "source_pos_raw",
  "source_meaning_raw",
  "raw_entry",
  "parse_status",
  "parse_issues",
  "source_review_note",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOC_UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

function category(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "object") {
    return "object";
  }
  return typeof value;
}

describe("dedicated Gate B source-entries diagnosis", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");
  const applyImport = readFileSync(path.join(process.cwd(), APPLY_IMPORT), "utf8");
  const integration = readFileSync(path.join(process.cwd(), INTEGRATION), "utf8");
  const firstBatch = toVocabularyImportRows(
    loadVocabularyDataset(),
  ).sourceEntries.slice(0, 200);

  it("locks catalog-match diagnosis without authorizing a third apply", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("Local diagnosis of the stable first-batch");
    expect(text).toContain("SOURCE_ENTRIES_UPSERT");
    expect(text).toContain("This task did not run `scripts/import-vocabulary.ts --apply`.");
    expect(text).toContain("A third import attempt is not authorized.");
    expect(text).toContain("LOCAL_CONTRACT_MATCHES_REMOTE_CATALOG");
    expect(text).toContain("REMOTE_POSTGREST_WRITE_PATH_REMAINS_SUSPECT");
    expect(text).toContain("THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED");
    expect(text).toContain("PR_17_REMAINS_UNMERGED");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(INSPECTED_HEAD);
    expect(text).toContain(EVIDENCE_HEAD);
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("providerCode");
    expect(text).toContain("HTTP_4XX");
    expect(text).toContain("HTTP_5XX");
    expect(text).toContain("NO_STATUS");
    expect(text).toContain("json_to_recordset");
    expect(text).toContain("ON CONFLICT (id)");
    expect(text).toContain("PostgreSQL **16.15**");
    expect(text).toContain("first batch inserted `200` rows");
    expect(text).not.toContain("GATE_B_VOCABULARY_IMPORTED");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(DOC_UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/PR #17 was merged/i);
  });

  it("locks current hashes and the unspecified upsert call", () => {
    for (const [file, expected] of Object.entries(LOCKED_SHA256)) {
      expect(text, file).toContain(expected);
      expect(sha256(file), file).toBe(expected);
    }
    expect(applyImport).toContain("client.from(table).upsert(slice)");
    expect(applyImport).not.toMatch(/onConflict/);
    expect(applyImport).not.toMatch(/returning:/);
    expect(applyImport).not.toMatch(/db:\s*['\"]/);
  });

  it("locks the first-batch payload shape without business values", () => {
    expect(firstBatch).toHaveLength(200);
    const extraKeys = firstBatch.flatMap((row) =>
      Object.keys(row).filter(
        (key) =>
          !IMPORTER_FIELDS.includes(key as (typeof IMPORTER_FIELDS)[number]),
      ),
    );
    const missingKeys = firstBatch.flatMap((row) =>
      IMPORTER_FIELDS.filter((field) => !Object.hasOwn(row, field)),
    );
    const undefinedValues = firstBatch.flatMap((row) =>
      IMPORTER_FIELDS.filter((field) => row[field] === undefined),
    );
    expect(extraKeys).toEqual([]);
    expect(missingKeys).toEqual([]);
    expect(undefinedValues).toEqual([]);

    const counts: Record<string, Record<string, number>> = {};
    const emptyString: Record<string, number> = {};
    let uuidOk = 0;
    const parseIssueLengths: Record<string, number> = {};
    for (const field of IMPORTER_FIELDS) {
      counts[field] = {};
      emptyString[field] = 0;
    }
    for (const row of firstBatch) {
      for (const field of IMPORTER_FIELDS) {
        const value = row[field];
        const kind = category(value);
        counts[field][kind] = (counts[field][kind] ?? 0) + 1;
        if (value === "") {
          emptyString[field] += 1;
        }
        if (field === "id" && typeof value === "string" && UUID_RE.test(value)) {
          uuidOk += 1;
        }
        if (field === "parse_issues" && Array.isArray(value)) {
          const key = String(value.length);
          parseIssueLengths[key] = (parseIssueLengths[key] ?? 0) + 1;
        }
      }
    }

    expect(counts.id).toEqual({ string: 200 });
    expect(uuidOk).toBe(200);
    expect(counts.canonical_key).toEqual({ string: 200 });
    expect(counts.source_index).toEqual({ number: 200 });
    expect(counts.section).toEqual({ string: 200 });
    expect(counts.source_page_start).toEqual({ number: 200 });
    expect(counts.source_page_end).toEqual({ number: 200 });
    expect(counts.source_word_raw).toEqual({ string: 200 });
    expect(counts.starred).toEqual({ boolean: 200 });
    expect(counts.source_ipa_raw).toEqual({ string: 197, null: 3 });
    expect(counts.source_pos_raw).toEqual({ string: 200 });
    expect(counts.source_meaning_raw).toEqual({ string: 200 });
    expect(counts.raw_entry).toEqual({ string: 200 });
    expect(counts.parse_status).toEqual({ string: 200 });
    expect(counts.parse_issues).toEqual({ array: 200 });
    expect(parseIssueLengths).toEqual({ "0": 197, "1": 3 });
    expect(counts.source_review_note).toEqual({ null: 198, string: 2 });
    expect(Object.values(emptyString).every((count) => count === 0)).toBe(true);
  });

  it("keeps the PostgreSQL reproduction opt-in and out of the default file", () => {
    const header = readFileSync(
      path.join(
        process.cwd(),
        "tests/persistence/dedicated-gate-b-source-entries-diagnosis.test.ts",
      ),
      "utf8",
    ).split("describe(")[0];
    expect(header).not.toContain("atomicity-harness");
    expect(integration).toContain(
      'process.env.RUN_DEDICATED_GATE_B_SOURCE_ENTRIES_DIAGNOSIS === "1"',
    );
    expect(integration).toContain("describe.skipIf(!LIVE)");
    expect(integration).toContain("LOCAL_POSTGRESQL_16_REQUIRED");
    expect(integration).toContain("buildChildEnv()");
  });
});
