import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOC =
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_GATE_B_IMPORT_DIAGNOSIS.md";
const SCRIPT = "scripts/import-vocabulary.ts";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
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

describe("dedicated baseline V0 Gate B import diagnosis", () => {
  const text = readFileSync(path.join(process.cwd(), DOC), "utf8");
  const script = readFileSync(path.join(process.cwd(), SCRIPT), "utf8");

  it("locks confirmed defects and refuses unproven historical causes", () => {
    expect(text).toContain("Retry remains unauthorized");
    expect(text).toContain("createSupabaseServerClient()");
    expect(text).toContain("void main()");
    expect(text).toContain("threw the raw PostgREST error object");
    expect(text).toContain("VOCABULARY_IMPORT_SERVICE_ROLE_REQUIRED");
    expect(text).toContain("VocabularyImportBatchError");
    expect(text).toContain("CURRENT_POSTGREST_READ_PATH_NOT_FULLY_AVAILABLE");
    expect(text).toContain("HISTORICAL_OPAQUE_FAILURE_CAUSE_NOT_RECOVERABLE");
    expect(text).toContain("POSTGREST_OTHER_SAFE_ERROR");
    expect(text).toContain("The original provider code is unknown.");
    expect(text).toContain("The original failing table and batch are unknown.");
    expect(text).toContain("Schema cache is not proven as the historical cause.");
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(script).toContain("createSupabaseServiceRoleClient");
    expect(script).not.toContain("createSupabaseServerClient");
    expect(text).not.toContain("GATE_B_VOCABULARY_IMPORTED");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
  });
});
