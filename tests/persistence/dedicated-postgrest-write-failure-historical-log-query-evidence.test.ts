import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVIDENCE =
  "docs/DEDICATED_WORDRANGER_POSTGREST_WRITE_FAILURE_HISTORICAL_LOG_QUERY_EVIDENCE.md";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const QUERY_HEAD = "1401f5d5aab260b8827581beb18e65013446d69c";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

describe("dedicated PostgREST write-failure historical log query evidence", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");

  it("locks one projected log query without a write or third import", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("one authorized");
    expect(text).toContain("read-only historical log query");
    expect(text).toContain("This is not a write probe and not a third import.");
    expect(text).toContain("HISTORICAL_WRITE_LOGS_NOT_FOUND");
    expect(text).toContain("WINDOW_1_ERROR_SQLSTATE_42703");
    expect(text).toContain("TABLE_RELATED_NOT_CONFIRMED");
    expect(text).toContain("HISTORICAL_REQUEST_ROLE_NOT_VERIFIED");
    expect(text).toContain("RETENTION_COVERS_WINDOW");
    expect(text).toContain("**`PRO`**");
    expect(text).toContain("POSTGRES_LOGS_EMPTY");
    expect(text).toContain("EDGE_LOGS_EMPTY");
    expect(text).toContain("AUTHENTICATOR");
    expect(text).toContain("42703");
    expect(text).toContain("CODE_NOT_SEPARABLE_FROM_PAYLOAD");
    expect(text).toContain("LINKED_IS_LEGACY_EXCLUDED");
    expect(text).toContain("SERVICE_ROLE_NOT_USED");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain("WRITE_PROBE_NOT_AUTHORIZED");
    expect(text).toContain("TX_ROLLBACK_NOT_HONORED");
    expect(text).toContain("THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED");
    expect(text).toContain("PR_17_REMAINS_UNMERGED");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain("impossible self-reference");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain(QUERY_HEAD);
    expect(text).toContain("This document does not authorize another log dump");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(/lcjysnyb/i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/PR #17 was merged/i);
    expect(text).not.toMatch(/this document authorizes/i);
    expect(text).not.toContain("VOCABULARY_IMPORT_APPLIED");
    expect(text).not.toContain("write probe executed");
    expect(text).not.toContain("third import executed");
    expect(text).not.toContain("service_role inferred");
  });

  it("does not treat the unconfirmed SQLSTATE as an apply authorization", () => {
    expect(text).toContain("**not** a confirmed `vocabulary_source_entries`");
    expect(text).toContain("It does not authorize a write, a write probe, or a third");
    expect(text).toContain("The undefined column name was not read");
    expect(text).toContain("A gateway `PGRSTnnn` was not recovered");
    expect(text).toContain("Window-1 `42703` is not claimed to be the upsert");
    expect(text).toContain("Path, status, and time");
    expect(text).toContain("were not used to infer `service_role`");
    expect(text).toContain("Dashboard SQL Editor was not used");
    expect(text).toContain("Raw log rows were not exported");
  });
});
