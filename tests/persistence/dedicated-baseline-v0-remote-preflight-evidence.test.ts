import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_BASELINE_V0_REMOTE_PREFLIGHT_EVIDENCE.md";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const INSPECTED_HEAD = "1f42a027f6dbda849aa5ed527911abd3a5ceaef0";
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

describe("dedicated baseline V0 remote preflight evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");

  it("locks non-secret classifications without storing identities", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("Gate A was not executed");
    expect(text).toContain("Gate A apply was **not** executed");
    expect(text).toContain("Remote apply remains **unauthorized**");
    expect(text).toContain("GATE_A_APPLY_REQUIRES_SEPARATE_AUTHORIZATION");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(INSPECTED_HEAD);
    expect(text).toContain(BASELINE);
    expect(text).toContain("202609260001");
    expect(text).toContain("dedicated_wordranger_baseline_v0");
    expect(text).toContain(BASELINE_SHA256);
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("DEDICATED_API_AND_DB_MATCH");
    expect(text).toContain("SERVICE_ROLE_SNAPSHOT_MATCH");
    expect(text).toContain("LEGACY_SOURCE_EXCLUDED");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("TARGET_EMPTY_CATALOG_VERIFIED");
    expect(text).toContain("HISTORY_INFRASTRUCTURE_ABSENT");
    expect(text).toContain("SHARED_BLAZE_OBJECTS_ABSENT");
    expect(text).toContain("REQUIRED_ROLES_RECOGNIZABLE");
    expect(text).toContain("PGCRYPTO_INSTALLED");
    expect(text).toContain("No DDL occurred.");
    expect(text).toContain("No DML occurred.");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/schema baseline applied/i);
    expect(text).not.toMatch(/PR #17 was merged/i);
    expect(text).not.toMatch(/this document authorizes/i);
    expect(text).not.toMatch(/Gate A was executed/i);
  });

  it("documents the later apply channel without executing it", () => {
    expect(text).toContain("./node_modules/.bin/supabase db push");
    expect(text).toContain("--db-url <Dedicated direct connection>");
    expect(text).toContain("--skip-vault");
    expect(text).toContain("--workdir <reviewed isolated workdir>");
    expect(text).toContain("--linked");
    expect(text).toContain("--include-all");
    expect(text).toContain("--include-seed");
    expect(text).toContain("--include-roles");
    expect(text).toContain("Dashboard SQL Editor");
    expect(text).toContain("migration repair");
    expect(text).toContain("documentation only, not executed");
  });
});
