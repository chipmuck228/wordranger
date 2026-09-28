import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_SOURCE_REJECTED,
  DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED,
  EXPECTED_CONTENT_FINGERPRINT,
  POOLED_TRANSACTION_QUERY_REJECTED,
  REMOTE_TLS_REJECTED,
  REMOTE_TLS_VERIFIED,
  REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
  classifyDirectDbTlsIdentity,
  plannedCurrentDatabaseClassSql,
  plannedHistoryIdentitySql,
  plannedReadonlyReconcilePrefix,
  plannedZeroCountSql,
} from "@/server/vocabulary/import/transactional-direct-postgres-plan";
import {
  applyBypassRejected,
  classifySnapshotIdentity,
  extractSupabaseRef,
  isPoolerUrl,
  parseDirectPostgresCliMode,
  parseSnapshotEnvFile,
  pickDirectDbUrl,
  refuseDirectPostgresApply,
  runTransactionalDirectPostgresCli,
} from "@/server/vocabulary/import/transactional-direct-postgres-runner";

const PLAN =
  "docs/DEDICATED_WORDRANGER_TRANSACTIONAL_DIRECT_POSTGRES_IMPORT_CANDIDATE.md";
const RUNBOOK =
  "docs/DEDICATED_WORDRANGER_TRANSACTIONAL_DIRECT_POSTGRES_IMPORT_RUNBOOK.md";
const RUNNER_DOC =
  "docs/DEDICATED_WORDRANGER_TRANSACTIONAL_DIRECT_POSTGRES_RUNNER_CANDIDATE.md";
const RUNNER =
  "src/server/vocabulary/import/transactional-direct-postgres-runner.ts";
const SCRIPT = "scripts/import-vocabulary-direct-postgres.ts";
const LIVE =
  "tests/persistence/dedicated-vocabulary-transactional-direct-postgres-runner.live.ts";
const LIVE_GATE =
  "tests/persistence/dedicated-vocabulary-transactional-direct-postgres-runner-live-gate.ts";
const LIVE_CONFIG = "vitest.transactional-direct-postgres-runner.config.ts";
const DEFAULT_VITEST = "vitest.config.ts";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

describe("dedicated transactional direct-Postgres runner candidate", () => {
  const runner = readFileSync(path.join(process.cwd(), RUNNER), "utf8");
  const script = readFileSync(path.join(process.cwd(), SCRIPT), "utf8");
  const doc = readFileSync(path.join(process.cwd(), RUNNER_DOC), "utf8");
  const plan = readFileSync(path.join(process.cwd(), PLAN), "utf8");
  const runbook = readFileSync(path.join(process.cwd(), RUNBOOK), "utf8");
  const defaultVitest = readFileSync(
    path.join(process.cwd(), DEFAULT_VITEST),
    "utf8",
  );
  const live = readFileSync(path.join(process.cwd(), LIVE), "utf8");
  const liveConfig = readFileSync(path.join(process.cwd(), LIVE_CONFIG), "utf8");

  it("locks the one-shot runner as a candidate, not a live harness", () => {
    expect(doc).toMatch(/Candidate \/ Not a Standard/);
    expect(doc).toMatch(/does not authorize remote\s+execution/);
    expect(doc).toContain("REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED");
    expect(doc).toContain("DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED");
    expect(doc).toContain("BEGIN READ ONLY");
    expect(doc).toContain("pg_backend_pid");
    expect(doc).toContain("live-test harness is not the production runner");
    expect(doc).toContain(ORIGIN_MAIN);
    expect(doc).toContain(PRODUCTION_ALIAS_FULL);
    expect(doc).toContain(EXPECTED_CONTENT_FINGERPRINT);
    expect(doc).not.toMatch(/https?:\/\//i);
    expect(doc).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(doc).not.toMatch(/lcjysnyb/i);
    expect(doc).not.toMatch(UUID_RE);
    expect(doc).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(plan).toContain("one-shot runner");
    expect(runbook).toContain("import-vocabulary-direct-postgres");
    expect(sha256("supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql")).toBe(
      BASELINE_SHA256,
    );
  });

  it("hard-closes --apply and ignores bypass env or extra flags", async () => {
    expect(parseDirectPostgresCliMode(["--apply"])).toBe("apply");
    expect(parseDirectPostgresCliMode(["--preflight", "--apply"])).toBe("apply");
    expect(refuseDirectPostgresApply()).toBe(
      REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
    );
    expect(
      applyBypassRejected({ ALLOW_REMOTE_TRANSACTIONAL_IMPORT: "1" }),
    ).toBe(true);
    const logs: string[] = [];
    const result = await runTransactionalDirectPostgresCli(
      ["--apply", "--preflight", "--i-authorize"],
      { ALLOW_REMOTE_TRANSACTIONAL_IMPORT: "1", DIRECT_POSTGRES_APPLY: "true" },
      {
        log: (value) => logs.push(value),
        error: (value) => logs.push(value),
      },
    );
    expect(result.mode).toBe("apply");
    expect(result.exitCode).toBe(1);
    expect(result.class).toBe(REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED);
    expect(logs.join("\n")).toContain(REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED);
    expect(runner).not.toContain("Promise.all");
    expect(runner).not.toContain("applyVocabularyImport");
    expect(runner).not.toContain("createSupabaseServiceRoleClient");
    expect(script).not.toContain("import-vocabulary.ts");
    expect(script).not.toContain("process.env");
    expect(script).toContain("runTransactionalDirectPostgresCli");
  });

  it("classifies snapshot identity, pooler refusal, and TLS identity", () => {
    const snapshot = parseSnapshotEnvFile(
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://abcdefghij0123456789.supabase.co",
        "POSTGRES_URL_NON_POOLING=postgresql://postgres.abcdefghij0123456789@db.abcdefghij0123456789.supabase.co:5432/postgres",
      ].join("\n"),
    );
    const identity = classifySnapshotIdentity({
      snapshot,
      envLocal: false,
      ambient: false,
      linked: false,
      composedFromRest: false,
    });
    expect("dbUrl" in identity).toBe(true);
    expect(extractSupabaseRef(snapshot.NEXT_PUBLIC_SUPABASE_URL)).toBe(
      "abcdefghij0123456789",
    );
    expect(
      isPoolerUrl("postgresql://user@aws-0-home.pooler.supabase.com:6543/postgres"),
    ).toBe(true);
    expect(
      pickDirectDbUrl({
        POSTGRES_URL: "postgresql://user@aws-0-home.pooler.supabase.com:6543/postgres",
      }),
    ).toBeNull();
    const poolerOnly = classifySnapshotIdentity({
      snapshot: {
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghij0123456789.supabase.co",
        POSTGRES_URL:
          "postgresql://postgres.abcdefghij0123456789@aws-0-home.pooler.supabase.com:6543/postgres",
      },
      envLocal: false,
      ambient: false,
      linked: false,
      composedFromRest: false,
    });
    expect(poolerOnly).toMatchObject({
      credentialSource: "DEDICATED_SNAPSHOT_ELIGIBLE",
      dedicatedTarget: {
        DEDICATED_API_AND_DB_MATCH: true,
        LEGACY_SOURCE_EXCLUDED: true,
      },
      pooled: POOLED_TRANSACTION_QUERY_REJECTED,
    });
    expect(
      classifyDirectDbTlsIdentity({
        sslmode: "require",
        rejectUnauthorized: true,
        hostnameVerified: true,
        chainVerified: true,
      }),
    ).toBe(DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED);
    expect(
      classifyDirectDbTlsIdentity({
        sslmode: "verify-full",
        rejectUnauthorized: true,
        hostnameVerified: true,
        chainVerified: true,
      }),
    ).toBe(REMOTE_TLS_VERIFIED);
    expect(
      classifyDirectDbTlsIdentity({ sslmode: "disable" }),
    ).toBe(REMOTE_TLS_REJECTED);
    expect(plannedReadonlyReconcilePrefix()).toMatch(/begin read only/i);
    expect(plannedCurrentDatabaseClassSql()).toContain("CURRENT_DATABASE_PRESENT");
    expect(plannedCurrentDatabaseClassSql()).toContain("current_database()");
    expect(plannedHistoryIdentitySql()).toContain("schema_migrations");
    expect(plannedZeroCountSql()).toContain("vocabulary_source_entries");
    expect(POOLED_TRANSACTION_QUERY_REJECTED).toBe(
      "POOLED_TRANSACTION_QUERY_REJECTED",
    );
    expect(CREDENTIAL_SOURCE_REJECTED).toBe("CREDENTIAL_SOURCE_REJECTED");
  });

  it("keeps the runner live file out of the default suite", () => {
    expect(LIVE.endsWith(".live.ts")).toBe(true);
    expect(existsSync(path.join(process.cwd(), LIVE))).toBe(true);
    expect(existsSync(path.join(process.cwd(), LIVE_GATE))).toBe(true);
    expect(defaultVitest).not.toContain("transactional-direct-postgres-runner.live");
    expect(liveConfig).toContain(LIVE);
    expect(live).toContain("describe.skipIf(!LIVE)");
    expect(live).toContain("REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED");
    expect(live).toContain("runTransactionalDirectPostgresCli");
    expect(live).not.toContain("classifyCommitAck(\"transport_error\")");
  });
});
