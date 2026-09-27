import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_GATE_A_APPLY_EVIDENCE.md";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const AUTHORIZED_HEAD = "8a3362e6f3eb9d56101cafe315522a07e9ceb863";
const BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

describe("dedicated baseline V0 Gate A apply evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");

  it("locks apply identities and success classifications without secrets", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("Local apply evidence only");
    expect(text).toContain("GATE_A_BASELINE_APPLIED");
    expect(text).toContain("SCHEMA_AND_HISTORY_POSTCONDITIONS_VERIFIED");
    expect(text).toContain("VOCABULARY_NOT_IMPORTED");
    expect(text).toContain("PR_17_REMAINS_UNMERGED");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(AUTHORIZED_HEAD);
    expect(text).toContain(BASELINE);
    expect(text).toContain("202609260001");
    expect(text).toContain("dedicated_wordranger_baseline_v0");
    expect(text).toContain(BASELINE_SHA256);
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(text).toContain("2.118.0");
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("DEDICATED_API_AND_DB_MATCH");
    expect(text).toContain("SERVICE_ROLE_SNAPSHOT_MATCH");
    expect(text).toContain("LEGACY_SOURCE_EXCLUDED");
    expect(text).toContain("TARGET_EMPTY_CATALOG_VERIFIED");
    expect(text).toContain("HISTORY_INFRASTRUCTURE_ABSENT");
    expect(text).toContain("SHARED_BLAZE_OBJECTS_ABSENT");
    expect(text).toContain("REQUIRED_ROLES_RECOGNIZABLE");
    expect(text).toContain("PGCRYPTO_INSTALLED");
    expect(text).toContain("APPLY_EXIT_ZERO");
    expect(text).toContain("HISTORY_POSTCONDITION_VERIFIED");
    expect(text).toContain("COMPLETE");
    expect(text).toContain("ALL_REQUIRED_TABLES_ZERO_ROWS");
    expect(text).toContain("VOCAB_SERVICE_ROLE_SUI_NO_DELETE");
    expect(text).toContain("LEARNER_SERVICE_ROLE_DML_CLIENTS_DENIED");
    expect(text).toContain("LEARNER_RLS_ENABLE_NOT_FORCE_NO_CLIENT_POLICIES");
    expect(text).toContain("SHARED_AND_OPTIONAL_OBJECTS_ABSENT");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("WORKTREE_REMOVED");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/PR #17 was merged/i);
    expect(text).not.toMatch(/this document authorizes import/i);
    expect(text).not.toMatch(/Gate B was authorized/i);
  });

  it("locks the sanitized apply channel and explicit non-claims", () => {
    expect(text).toContain("./node_modules/.bin/supabase db push");
    expect(text).toContain("--db-url <Dedicated direct connection>");
    expect(text).toContain("--skip-vault");
    expect(text).toContain("--workdir <reviewed isolated workdir>");
    expect(text).toContain("--linked");
    expect(text).toContain("--include-all");
    expect(text).toContain("--include-seed");
    expect(text).toContain("--include-roles");
    expect(text).toContain("Executed exactly once");
    expect(text).toContain("Vocabulary was not imported.");
    expect(text).toContain("Learner data was not written.");
    expect(text).toContain("`/train` was not started.");
    expect(text).toContain("PR #17 was not merged.");
    expect(text).toContain("Vercel env was unchanged.");
    expect(text).toContain("Production was not redeployed.");
    expect(text).toContain("Gate B is not authorized.");
  });
});
