import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import {
  COMMIT_CONFIRMED,
  COMMIT_OUTCOME_UNKNOWN,
  COMMIT_RECONCILED_COMPLETE,
  COMMIT_RECONCILED_ROLLED_BACK,
  COMMIT_RECONCILIATION_FAILED,
  CREDENTIAL_SOURCE_REJECTED,
  EXPECTED_CONTENT_FINGERPRINT,
  EXPECTED_FINGERPRINT_VERSION,
  EXPECTED_LEXEMES,
  EXPECTED_RELATIONS,
  EXPECTED_SOURCE_ENTRIES,
  EXPECTED_TAGS,
  FORBIDDEN_CREDENTIAL_SOURCES,
  FORBIDDEN_TLS_MARKERS,
  HISTORY_WRITE_REJECTED,
  LEARNER_TABLES,
  POOLED_TRANSACTION_QUERY_REJECTED,
  POSTGREST_IMPORT_PATH_SUSPENDED,
  PROMISE_ALL_IN_TRANSACTION_REJECTED,
  REMOTE_TLS_REJECTED,
  REMOTE_TLS_VERIFIED,
  REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
  RESEND_COMMIT_REJECTED,
  RETRY_AFTER_UNKNOWN_COMMIT_REJECTED,
  SCHEMA_CHANGE_REJECTED,
  SET_LOCAL_ROLE_REQUIRED,
  STALE_ROW_DELETE_REJECTED,
  THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED,
  TRANSACTION_CONNECTION_MISMATCH,
  TRANSACTION_STEPS,
  VOCABULARY_TABLES,
  actionsAfterReconciliationFailed,
  actionsAfterUnknownCommit,
  assertSameTransactionConnection,
  classifyCommitAck,
  classifyCredentialSource,
  classifyDedicatedTarget,
  classifyReconciliation,
  classifyRemoteTls,
  currentTransactionalImportAuthorization,
  plannedCountAndLearnerGuardSql,
  plannedInitialEmptyGuardSql,
  plannedPrivilegeProbeSql,
  plannedTransactionPrefix,
  plannedVocabularyUpserts,
  refusePooledTransactionQuery,
  refusePromiseAllInTransaction,
  refuseRemoteTransactionalImport,
  refuseResendCommit,
  refuseRetryAfterUnknownCommit,
} from "@/server/vocabulary/import/transactional-direct-postgres-plan";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

const PLAN =
  "docs/DEDICATED_WORDRANGER_TRANSACTIONAL_DIRECT_POSTGRES_IMPORT_CANDIDATE.md";
const RUNBOOK =
  "docs/DEDICATED_WORDRANGER_TRANSACTIONAL_DIRECT_POSTGRES_IMPORT_RUNBOOK.md";
const PLANNER =
  "src/server/vocabulary/import/transactional-direct-postgres-plan.ts";
const LIVE =
  "tests/persistence/dedicated-vocabulary-transactional-direct-postgres-import.live.ts";
const LIVE_GATE =
  "tests/persistence/dedicated-vocabulary-transactional-direct-postgres-import-live-gate.ts";
const LIVE_CONFIG = "vitest.transactional-direct-postgres.config.ts";
const DEFAULT_VITEST = "vitest.config.ts";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const EVIDENCE_HEAD = "41f53c61a1cdabae93d5976732a0200872bdfdeb";
const BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";
const SOURCE_SHA256 =
  "f47afc841ffd5a9b5643499f38e158dd72481d4ad7bd0b7f12fa0ab87f1ed142";
const CANONICAL_SHA256 =
  "5dbbfd77aed165d55000746a45762615316ee43814045756f6d7ca9722e77910";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

describe("dedicated transactional direct-Postgres import candidate", () => {
  const text = readFileSync(path.join(process.cwd(), PLAN), "utf8");
  const runbook = readFileSync(path.join(process.cwd(), RUNBOOK), "utf8");
  const planner = readFileSync(path.join(process.cwd(), PLANNER), "utf8");
  const live = readFileSync(path.join(process.cwd(), LIVE), "utf8");
  const defaultVitest = readFileSync(
    path.join(process.cwd(), DEFAULT_VITEST),
    "utf8",
  );
  const liveConfig = readFileSync(path.join(process.cwd(), LIVE_CONFIG), "utf8");

  it("locks the local-only candidate and runbook", () => {
    for (const doc of [text, runbook]) {
      expect(doc).toMatch(/Candidate \/ Not a Standard/);
      expect(doc).toContain("does not authorize remote execution");
      expect(doc).toContain("POSTGREST_IMPORT_PATH_SUSPENDED");
      expect(doc).toContain("REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED");
      expect(doc).toContain("THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED");
      expect(doc).toContain("PR_17_REMAINS_UNMERGED");
      expect(doc).toContain("PRODUCTION_REMAINS_ON_782FFCC");
      expect(doc).toContain(ORIGIN_MAIN);
      expect(doc).toContain(PRODUCTION_ALIAS_FULL);
      expect(doc).toContain(EVIDENCE_HEAD);
      expect(doc).toContain("impossible self-reference");
      expect(doc).not.toMatch(/https?:\/\//i);
      expect(doc).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
      expect(doc).not.toMatch(/lcjysnyb/i);
      expect(doc).not.toMatch(UUID_RE);
      expect(doc).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
      expect(doc).not.toContain("VOCABULARY_IMPORT_APPLIED");
    }
    expect(text).toContain("TABLE_RELATED_NOT_CONFIRMED");
    expect(text).toContain("Local PostgreSQL 16 success is not remote");
    expect(text).toContain("COMMIT_OUTCOME_UNKNOWN");
    expect(text).toContain("COMMIT_RECONCILED_COMPLETE");
    expect(text).toContain("COMMIT_RECONCILED_ROLLED_BACK");
    expect(text).toContain("COMMIT_RECONCILIATION_FAILED");
    expect(text).toContain("POOLED_TRANSACTION_QUERY_REJECTED");
    expect(text).toContain("PROMISE_ALL_IN_TRANSACTION_REJECTED");
    expect(text).toContain("sslmode=disable");
    expect(text).toContain("TEMP_DELETED");
    expect(text).toContain(EXPECTED_CONTENT_FINGERPRINT);
    expect(sha256(BASELINE)).toBe(BASELINE_SHA256);
    expect(sha256("data/vocabulary/source/words-source.json")).toBe(
      SOURCE_SHA256,
    );
    expect(sha256("data/vocabulary/canonical/words-canonical.json")).toBe(
      CANONICAL_SHA256,
    );
  });

  it("classifies commit ack, reconciliation, and refused follow-ups", () => {
    expect(classifyCommitAck("ok")).toBe(COMMIT_CONFIRMED);
    expect(classifyCommitAck("transport_error")).toBe(COMMIT_OUTCOME_UNKNOWN);
    expect(
      classifyReconciliation({
        sourceEntries: EXPECTED_SOURCE_ENTRIES,
        lexemes: EXPECTED_LEXEMES,
        relations: EXPECTED_RELATIONS,
        tags: EXPECTED_TAGS,
        fingerprintVersion: EXPECTED_FINGERPRINT_VERSION,
        fingerprint: EXPECTED_CONTENT_FINGERPRINT,
        learner: 0,
      }),
    ).toBe(COMMIT_RECONCILED_COMPLETE);
    expect(
      classifyReconciliation({
        sourceEntries: 0,
        lexemes: 0,
        relations: 0,
        tags: 0,
        fingerprintVersion: EXPECTED_FINGERPRINT_VERSION,
        fingerprint: "0".repeat(64),
        learner: 0,
      }),
    ).toBe(COMMIT_RECONCILED_ROLLED_BACK);
    expect(
      classifyReconciliation({
        sourceEntries: 200,
        lexemes: 0,
        relations: 0,
        tags: 0,
        fingerprintVersion: EXPECTED_FINGERPRINT_VERSION,
        fingerprint: EXPECTED_CONTENT_FINGERPRINT,
        learner: 0,
      }),
    ).toBe(COMMIT_RECONCILIATION_FAILED);
    expect(
      classifyReconciliation({
        sourceEntries: EXPECTED_SOURCE_ENTRIES,
        lexemes: EXPECTED_LEXEMES,
        relations: EXPECTED_RELATIONS,
        tags: EXPECTED_TAGS,
        fingerprintVersion: EXPECTED_FINGERPRINT_VERSION,
        fingerprint: EXPECTED_CONTENT_FINGERPRINT,
        learner: 1,
      }),
    ).toBe(COMMIT_RECONCILIATION_FAILED);
    expect(
      classifyReconciliation({
        sourceEntries: 0,
        lexemes: 0,
        relations: 0,
        tags: 0,
        fingerprintVersion: EXPECTED_FINGERPRINT_VERSION,
        fingerprint: "0".repeat(64),
        learner: 0,
        readable: false,
      }),
    ).toBe(COMMIT_RECONCILIATION_FAILED);
    const unknown = actionsAfterUnknownCommit();
    expect(unknown.retryImport).toBe(false);
    expect(unknown.resendCommit).toBe(false);
    expect(unknown.deleteRows).toBe(false);
    expect(unknown.reconcileReadonly).toBe(true);
    expect(unknown.requireNewConnection).toBe(true);
    expect(actionsAfterReconciliationFailed()).toEqual({
      stop: true,
      retryImport: false,
      deleteRows: false,
      repair: false,
      postgrestImport: false,
      startTrain: false,
    });
    expect(refuseRetryAfterUnknownCommit()).toBe(
      RETRY_AFTER_UNKNOWN_COMMIT_REJECTED,
    );
    expect(refuseResendCommit()).toBe(RESEND_COMMIT_REJECTED);
  });

  it("locks connection discipline, role contract, and TLS/credential denies", () => {
    expect(TRANSACTION_STEPS[0]).toBe("acquire_one_dedicated_connection");
    expect(TRANSACTION_STEPS[2]).toBe("set_local_role_service_role");
    expect(plannedTransactionPrefix()).toContain("set local role service_role");
    expect(plannedPrivilegeProbeSql()).toContain("session_user");
    expect(plannedPrivilegeProbeSql()).toContain("current_user");
    expect(SET_LOCAL_ROLE_REQUIRED).toBe("SET LOCAL ROLE service_role");
    expect(refusePooledTransactionQuery()).toBe(
      POOLED_TRANSACTION_QUERY_REJECTED,
    );
    expect(refusePromiseAllInTransaction()).toBe(
      PROMISE_ALL_IN_TRANSACTION_REJECTED,
    );
    expect(() => assertSameTransactionConnection("a", "b")).toThrow(
      TRANSACTION_CONNECTION_MISMATCH,
    );
    assertSameTransactionConnection("conn-1", "conn-1");
    expect(
      classifyRemoteTls({
        sslmode: "verify-full",
        rejectUnauthorized: true,
      }),
    ).toBe(REMOTE_TLS_VERIFIED);
    expect(classifyRemoteTls({ sslmode: "disable" })).toBe(REMOTE_TLS_REJECTED);
    expect(classifyRemoteTls({ rejectUnauthorized: false })).toBe(
      REMOTE_TLS_REJECTED,
    );
    expect(classifyRemoteTls({ nodeTlsRejectUnauthorized: "0" })).toBe(
      REMOTE_TLS_REJECTED,
    );
    expect(classifyRemoteTls({ curlInsecure: true })).toBe(REMOTE_TLS_REJECTED);
    expect(
      classifyCredentialSource({
        vercelProductionSnapshot: true,
        envLocal: false,
        ambient: false,
        linked: false,
        composedFromRest: false,
      }),
    ).toBe("DEDICATED_SNAPSHOT_ELIGIBLE");
    expect(
      classifyCredentialSource({
        vercelProductionSnapshot: true,
        envLocal: true,
        ambient: false,
        linked: false,
        composedFromRest: false,
      }),
    ).toBe(CREDENTIAL_SOURCE_REJECTED);
    expect(
      classifyDedicatedTarget({
        apiDedicated: true,
        dbDedicated: true,
        legacyExcluded: true,
      }),
    ).toEqual({
      DEDICATED_API_AND_DB_MATCH: true,
      LEGACY_SOURCE_EXCLUDED: true,
    });
    expect(
      classifyDedicatedTarget({
        apiDedicated: true,
        dbDedicated: true,
        legacyExcluded: false,
      }),
    ).toBe(CREDENTIAL_SOURCE_REJECTED);
    expect(FORBIDDEN_TLS_MARKERS).toContain("sslmode=disable");
    expect(FORBIDDEN_CREDENTIAL_SOURCES).toContain(".env.local");
    expect(currentTransactionalImportAuthorization()).toMatchObject({
      remote: REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
      postgrest: POSTGREST_IMPORT_PATH_SUSPENDED,
      thirdImport: THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED,
      historyWrite: HISTORY_WRITE_REJECTED,
      schemaChange: SCHEMA_CHANGE_REJECTED,
      staleDelete: STALE_ROW_DELETE_REJECTED,
    });
    expect(refuseRemoteTransactionalImport()).toBe(
      REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
    );
    expect(VOCABULARY_TABLES).toHaveLength(4);
    expect(LEARNER_TABLES).toHaveLength(6);
    const sql = plannedVocabularyUpserts(
      toVocabularyImportRows(loadVocabularyDataset()),
    );
    expect(sql).not.toMatch(/\bdelete\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(plannedInitialEmptyGuardSql()).toContain("source_count <> 0");
    expect(
      plannedCountAndLearnerGuardSql({
        sourceEntries: 1600,
        lexemes: 1638,
        relations: 716,
        tags: 1638,
      }),
    ).toContain("LEARNER_TABLES_NOT_ZERO");
    expect(planner).not.toContain("Promise.all");
    expect(live).not.toContain("Promise.all");
  });

  it("keeps the PostgreSQL 16 live file undiscovered by the default suite", () => {
    expect(LIVE.endsWith(".live.ts")).toBe(true);
    expect(LIVE.endsWith(".test.ts")).toBe(false);
    expect(existsSync(path.join(process.cwd(), LIVE))).toBe(true);
    expect(existsSync(path.join(process.cwd(), LIVE_GATE))).toBe(true);
    expect(defaultVitest).toContain(
      'include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]',
    );
    expect(defaultVitest).not.toContain("transactional-direct-postgres-import.live");
    expect(defaultVitest).not.toContain("exclude");
    expect(liveConfig).toContain(LIVE);
    expect(live).toContain("describe.skipIf(!LIVE)");
    expect(live).toContain("requireLocalPostgresql16(postgresHarnessAvailable())");
    expect(live).toContain("COMMIT_OUTCOME_UNKNOWN");
    expect(live).toContain("COMMIT_RECONCILED_COMPLETE");
    expect(live).toContain("COMMIT_RECONCILED_ROLLED_BACK");
    expect(live).toContain("COMMIT_RECONCILIATION_FAILED");
    expect(live).toContain("connectionId");
  });
});
