import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_POSTGREST_WRITE_PROBE_CAPABILITY_PREFLIGHT_EVIDENCE.md";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const INSPECTED_HEAD = "61c755e06f94a8817a2453f4b21575c106318c04";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";

const CAPTURED_SHA256 = {
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql":
    "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe",
  "src/server/vocabulary/import/apply-import.ts":
    "3b65732cafc8d03e306b75b82654c56ac0fdb6afbdc1f55d71b436a7d7731b53",
  "src/server/vocabulary/import/batch-error.ts":
    "2558791095682ee404232277954c0f542156f2bc0af645b70adb2fc29efd4ce6",
  "src/server/vocabulary/import/import-rows.ts":
    "44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36",
} as const;

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

describe("dedicated PostgREST write-probe capability preflight evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");

  it("locks the authorized GET without opening a write or third import", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain(
      "authorized remote read-only capability GET.",
    );
    expect(text).toContain("This is not a write probe and not a third import.");
    expect(text).toContain("This task performed no remote write.");
    expect(text).toContain("Request body: none");
    expect(text).not.toMatch(/\bNo body\b/);
    expect(text).toContain("CAPABILITY_GET_TRANSPORT_FAILED");
    expect(text).toContain("TX_ROLLBACK_HONOR_UNPROVEN");
    expect(text).toContain("WRITE_PROBE_NOT_AUTHORIZED");
    expect(text).toContain("THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED");
    expect(text).toContain("PR_17_REMAINS_UNMERGED");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("CAPABILITY_PREFLIGHT_EXECUTED");
    expect(text).toContain("DEDICATED_API_AND_DB_MATCH");
    expect(text).toContain("SERVICE_ROLE_SNAPSHOT_MATCH");
    expect(text).toContain("LEGACY_SOURCE_EXCLUDED");
    expect(text).toContain("ECONNRESET");
    expect(text).toContain("CURL_EXIT_35");
    expect(text).toContain("No HTTP status was received");
    expect(text).toContain("No response headers were");
    expect(text).toContain("This is not `TX_ROLLBACK_HONORED`");
    expect(text).toContain("This is not `TX_ROLLBACK_NOT_HONORED`");
    expect(text).toContain("Transport failure proves neither");
    expect((text.match(/TX_ROLLBACK_HONORED/g) ?? []).length).toBe(1);
    expect((text.match(/TX_ROLLBACK_NOT_HONORED/g) ?? []).length).toBe(1);
    expect(text).toContain(
      "A later successful GET with `Preference-Applied: tx=rollback` would provide capability evidence only.",
    );
    expect(text).toContain(
      "It would not itself authorize or prove zero-residue behavior for a POST write probe.",
    );
    expect(text).toContain("POST rollback was not tested");
    expect(text).toContain("A successful GET can be capability evidence only.");
    expect(text).toContain("POST zero-residue behavior remains untested.");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(INSPECTED_HEAD);
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("Prefer sent");
    expect(text).toContain("tx=rollback");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(/lcjysnyb/i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/PR #17 was merged/i);
    expect(text).not.toMatch(/this document authorizes/i);
    expect(text).not.toMatch(/Gate B was retried/i);
    expect(text).not.toContain("VOCABULARY_IMPORT_APPLIED");
    expect(text).not.toContain("response body was empty");
    expect(text).not.toContain("Gate B passed");
    expect(text).not.toContain("vocabulary imported");
    expect(text).not.toContain("PR ready to merge");
    expect(text).not.toContain("write probe executed");
    expect(text).not.toContain("third import executed");
  });

  it("locks captured Content identity from the inspected head, not the live worktree", () => {
    expect(text).toContain(`Remote GET inspected commit:`);
    expect(text).toContain(INSPECTED_HEAD);
    expect(text).toContain(
      "recorded at remote capability GET inspected head",
    );
    expect(text).toContain("They are not a live lock");
    expect(text).toContain("does not require rewriting this historical record");
    expect(text).toContain("vocabulary-content-v1");
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain("1600");
    expect(text).toContain("1638");
    expect(text).toContain("716");
    for (const [file, digest] of Object.entries(CAPTURED_SHA256)) {
      expect(text, file).toContain(file);
      expect(text, file).toContain(digest);
    }
    expect(text).not.toContain("sha256(file)");
    expect(text).toContain("IMPORTER_APPLY_PATH_REJECTED");
    expect(text).toContain("Write probe was not executed.");
    expect(text).toContain("`--apply` was not executed against Dedicated.");
    expect(text).toContain("Gate B was not retried a third time.");
    expect(text).toContain("Vocabulary remains unimported.");
    expect(text).toContain("They do not mean PostgREST rejected");
    expect(text).toContain("They do not prove a later retry");
  });
});
