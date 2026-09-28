/**
 * One-shot transactional direct-Postgres runner candidate.
 * --apply is hard-closed. This module is not the live-test harness
 * and does not authorize a remote vocabulary import.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import tls from "node:tls";
import { toVocabularyImportRows } from "./import-rows";
import {
  fingerprintVocabularyImportRows,
} from "./rebuild-contract";
import {
  CREDENTIAL_SOURCE_REJECTED,
  CURRENT_DATABASE_ABSENT,
  CURRENT_DATABASE_PRESENT,
  DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED,
  EXPECTED_CONTENT_FINGERPRINT,
  EXPECTED_FINGERPRINT_VERSION,
  EXPECTED_LEXEMES,
  EXPECTED_RELATIONS,
  EXPECTED_SOURCE_ENTRIES,
  EXPECTED_TAGS,
  LEARNER_TABLES,
  POOLED_TRANSACTION_QUERY_REJECTED,
  REMOTE_TLS_REJECTED,
  REMOTE_TLS_VERIFIED,
  REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
  VOCABULARY_TABLES,
  classifyCredentialSource,
  classifyDedicatedTarget,
  classifyDirectDbTlsIdentity,
  parseReadonlyBoundaryProbe,
  plannedContaminationSql,
  plannedCountAndLearnerGuardSql,
  plannedCurrentDatabaseClassSql,
  plannedHistoryIdentitySql,
  plannedZeroCountSql,
  plannedInitialEmptyGuardSql,
  plannedLearnerRlsSql,
  plannedPrivilegeMatrixSql,
  plannedReadonlyBoundaryProbeSql,
  plannedReadonlyReconcilePrefix,
  plannedRequiredCoreInventorySql,
  plannedTransactionPrefix,
  plannedVocabularyUpserts,
  refuseRemoteTransactionalImport,
} from "./transactional-direct-postgres-plan";
import { loadVocabularyDataset } from "../load-vocabulary-dataset";

export const DIRECT_POSTGRES_APPLY_HARD_CLOSED =
  "REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED" as const;
export const LOCAL_LOOPBACK_ONLY = "LOCAL_LOOPBACK_ONLY" as const;
export const REMOTE_DRY_RUN_NOT_AUTHORIZED =
  "REMOTE_DRY_RUN_NOT_AUTHORIZED" as const;

export type DirectPostgresCliMode =
  | "fingerprint"
  | "validate"
  | "preflight"
  | "dry-run"
  | "apply";

export interface DirectPostgresCliIo {
  log: (value: string) => void;
  error: (value: string) => void;
}

export interface DirectPostgresCliResult {
  exitCode: number;
  mode: DirectPostgresCliMode;
  class: string;
}

export interface ReadonlyPreflightReport {
  class:
    | "READONLY_PREFLIGHT_COMPLETE"
    | typeof CREDENTIAL_SOURCE_REJECTED
    | typeof DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED
    | typeof REMOTE_TLS_REJECTED
    | typeof POOLED_TRANSACTION_QUERY_REJECTED
    | "READONLY_PREFLIGHT_FAILED";
  credentialSource?: string;
  dedicatedTarget?: string;
  tls?: string;
  currentDatabase?: typeof CURRENT_DATABASE_PRESENT | typeof CURRENT_DATABASE_ABSENT;
    history?: {
      count: number;
      version: string;
      name: string;
      class:
        | "HISTORY_POSTCONDITION_VERIFIED"
        | "HISTORY_POSTCONDITION_FAILED"
        | "HISTORY_UNREADABLE_AS_SERVICE_ROLE"
        | "HISTORY_INFRASTRUCTURE_ABSENT";
    };
  requiredCore?: {
    tables: number;
    functionPresent: boolean;
    triggerPresent: boolean;
    indexes: number;
    pgcrypto: boolean;
    class: "COMPLETE" | "INCOMPLETE";
  };
  counts?: {
    vocabularyZero: boolean;
    learnerZero: boolean;
    class: "ALL_REQUIRED_TABLES_ZERO_ROWS" | "REQUIRED_TABLES_NOT_ZERO";
  };
  vocabularyPrivileges?: "VOCAB_SERVICE_ROLE_SUI_NO_DELETE" | "VOCAB_PRIVILEGE_MISMATCH";
  learnerSecurity?:
    | "LEARNER_SERVICE_ROLE_DML_CLIENTS_DENIED"
    | "LEARNER_SECURITY_MISMATCH";
  contamination?:
    | "SHARED_AND_OPTIONAL_OBJECTS_ABSENT"
    | "SHARED_OR_OPTIONAL_OBJECT_PRESENT";
  roleSwitch?: "ROLE_SWITCH_VERIFIED" | "ROLE_SWITCH_FAILED";
  readonlyBoundary?: boolean;
  failureKind?: string;
}

const DENIED_AMBIENT = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
] as const;

export function parseDirectPostgresCliMode(
  argv: string[],
): DirectPostgresCliMode {
  if (argv.includes("--apply")) return "apply";
  if (argv.includes("--preflight")) return "preflight";
  if (argv.includes("--fingerprint")) return "fingerprint";
  if (argv.includes("--validate")) return "validate";
  if (argv.includes("--dry-run")) return "dry-run";
  return "validate";
}

export function refuseDirectPostgresApply(): typeof REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED {
  return refuseRemoteTransactionalImport();
}

export function applyBypassRejected(env: Record<string, string | undefined>): boolean {
  const keys = [
    "ALLOW_REMOTE_TRANSACTIONAL_IMPORT",
    "REMOTE_TRANSACTIONAL_IMPORT_AUTHORIZED",
    "DIRECT_POSTGRES_APPLY",
    "I_AUTHORIZE_REMOTE_IMPORT",
  ];
  return keys.some((key) => env[key] === "1" || env[key] === "true");
}

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  return argv[index + 1];
}

export function parseSnapshotEnvFile(contents: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const cut = line.indexOf("=");
    if (cut <= 0) continue;
    const key = line.slice(0, cut);
    let value = line.slice(cut + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function extractSupabaseRef(value: string): string | null {
  const api = value.match(
    /https:\/\/([a-z0-9]{20})\.supabase\.co/i,
  );
  if (api?.[1]) return api[1];
  const dbHost = value.match(/db\.([a-z0-9]{20})\.supabase\.co/i);
  if (dbHost?.[1]) return dbHost[1];
  const user = value.match(/postgres\.([a-z0-9]{20})(?:[:@/]|$)/i);
  if (user?.[1]) return user[1];
  return null;
}

export function isPoolerUrl(value: string): boolean {
  return /pooler\.supabase\.com|pgbouncer|:6543\b/i.test(value);
}

export function pickDirectDbUrl(snapshot: Record<string, string>): string | null {
  const candidates = [
    snapshot.POSTGRES_URL_NON_POOLING,
    snapshot.DIRECT_URL,
    snapshot.DATABASE_URL,
    snapshot.POSTGRES_URL,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const direct = candidates.find((value) => !isPoolerUrl(value));
  return direct ?? null;
}

export function classifySnapshotIdentity(input: {
  snapshot: Record<string, string>;
  envLocal: boolean;
  ambient: boolean;
  linked: boolean;
  composedFromRest: boolean;
}):
  | {
      credentialSource: "DEDICATED_SNAPSHOT_ELIGIBLE";
      dedicatedTarget: {
        DEDICATED_API_AND_DB_MATCH: true;
        LEGACY_SOURCE_EXCLUDED: true;
      };
      dbUrl: string;
    }
  | { credentialSource: typeof CREDENTIAL_SOURCE_REJECTED }
  | {
      credentialSource: "DEDICATED_SNAPSHOT_ELIGIBLE";
      dedicatedTarget: typeof CREDENTIAL_SOURCE_REJECTED;
    }
  | {
      credentialSource: "DEDICATED_SNAPSHOT_ELIGIBLE";
      dedicatedTarget: {
        DEDICATED_API_AND_DB_MATCH: true;
        LEGACY_SOURCE_EXCLUDED: true;
      };
      pooled: typeof POOLED_TRANSACTION_QUERY_REJECTED;
    } {
  const credentialSource = classifyCredentialSource({
    vercelProductionSnapshot: true,
    envLocal: input.envLocal,
    ambient: input.ambient,
    linked: input.linked,
    composedFromRest: input.composedFromRest,
  });
  if (credentialSource === CREDENTIAL_SOURCE_REJECTED) {
    return { credentialSource };
  }
  const apiUrl = input.snapshot.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const dbUrl = pickDirectDbUrl(input.snapshot);
  const apiRef = extractSupabaseRef(apiUrl);
  const anyDb = [
    input.snapshot.POSTGRES_URL_NON_POOLING,
    input.snapshot.DIRECT_URL,
    input.snapshot.DATABASE_URL,
    input.snapshot.POSTGRES_URL,
  ].find((value): value is string => typeof value === "string" && value.length > 0);
  const dbRef = extractSupabaseRef(dbUrl ?? anyDb ?? "");
  if (!dbUrl) {
    const target = classifyDedicatedTarget({
      apiDedicated: Boolean(apiRef),
      dbDedicated: Boolean(dbRef),
      legacyExcluded: Boolean(apiRef && dbRef && apiRef === dbRef),
    });
    if (target === CREDENTIAL_SOURCE_REJECTED) {
      return { credentialSource, dedicatedTarget: target };
    }
    return {
      credentialSource,
      dedicatedTarget: target,
      pooled: POOLED_TRANSACTION_QUERY_REJECTED,
    };
  }
  const target = classifyDedicatedTarget({
    apiDedicated: Boolean(apiRef),
    dbDedicated: Boolean(dbRef),
    legacyExcluded: Boolean(apiRef && dbRef && apiRef === dbRef),
  });
  if (target === CREDENTIAL_SOURCE_REJECTED) {
    return { credentialSource, dedicatedTarget: target };
  }
  return { credentialSource, dedicatedTarget: target, dbUrl };
}

export function parsePostgresUrl(url: string): {
  hostname: string;
  port: number;
  user: string;
  database: string;
  password: string;
  sslmode: string;
} {
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    password: decodeURIComponent(parsed.password),
    sslmode: parsed.searchParams.get("sslmode") ?? "require",
  };
}

export async function proveDirectDbTlsIdentity(input: {
  hostname: string;
  port: number;
}): Promise<
  | { class: typeof REMOTE_TLS_VERIFIED; hostnameVerified: true; chainVerified: true }
  | { class: typeof DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED }
  | { class: typeof REMOTE_TLS_REJECTED }
> {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    return { class: REMOTE_TLS_REJECTED };
  }
  return await new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: input.hostname,
        port: input.port,
        servername: input.hostname,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
      },
      () => {
        const authorized = socket.authorized;
        const cert = socket.getPeerCertificate();
        const hostnameVerified = Boolean(cert && socket.authorized);
        socket.end();
        if (!authorized) {
          resolve({ class: DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED });
          return;
        }
        const identity = classifyDirectDbTlsIdentity({
          sslmode: "verify-full",
          rejectUnauthorized: true,
          hostnameVerified,
          chainVerified: authorized,
        });
        if (identity === REMOTE_TLS_VERIFIED) {
          resolve({
            class: REMOTE_TLS_VERIFIED,
            hostnameVerified: true,
            chainVerified: true,
          });
          return;
        }
        resolve({ class: DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED });
      },
    );
    socket.on("error", () => {
      resolve({ class: DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED });
    });
  });
}

function asBool(value: string): boolean {
  return value === "t" || value === "true";
}

export function classifyVocabPrivilegeLine(line: string): boolean {
  const parts = line.split("|");
  if (parts.length < 12) return false;
  const expected = [
    false, false, false, false,
    false, false, false, false,
    true, true, true, false,
  ];
  return expected.every((want, index) => asBool(parts[index] ?? "") === want);
}

export function classifyLearnerPrivilegeLine(line: string): boolean {
  const parts = line.split("|");
  if (parts.length < 12) return false;
  const expected = [
    false, false, false, false,
    false, false, false, false,
    true, true, true, true,
  ];
  return expected.every((want, index) => asBool(parts[index] ?? "") === want);
}

export function classifyLearnerRlsLine(line: string): boolean {
  const [rls, force, policies] = line.split("|");
  return asBool(rls ?? "") && !asBool(force ?? "") && (policies === "0");
}

export interface SqlSession {
  exec(sql: string): Promise<void>;
  query(sql: string): Promise<string>;
  end(sql: "commit" | "rollback"): Promise<void>;
  abort(): Promise<void>;
}

function findPsqlBin(): string | null {
  const candidates = [
    "/opt/homebrew/opt/postgresql@16/bin/psql",
    "/usr/local/opt/postgresql@16/bin/psql",
    "/opt/homebrew/bin/psql",
    "/usr/lib/postgresql/16/bin/psql",
    "/usr/bin/psql",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function isolatedPsqlEnv(
  extra: Record<string, string>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    LANG: "C",
    LC_ALL: "C",
    ...extra,
  };
  return env;
}

export class PsqlRunnerSession implements SqlSession {
  private readonly child: ChildProcessWithoutNullStreams;
  private stdout = "";
  private stderr = "";
  private closed: Promise<number>;

  constructor(
    args: string[],
    extraEnv: Record<string, string>,
    binPath?: string,
  ) {
    const bin = binPath ?? findPsqlBin();
    if (!bin) {
      throw new Error("PSQL_BIN_MISSING");
    }
    this.child = spawn(
      bin,
      ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-q", ...args],
      { env: isolatedPsqlEnv(extraEnv) },
    );
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.stdout += chunk;
    });
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
    this.closed = new Promise((resolve) => {
      this.child.on("close", (code) => {
        setTimeout(() => resolve(code ?? 1), 30);
      });
    });
  }

  private write(sql: string): void {
    this.child.stdin.write(sql.endsWith("\n") ? sql : `${sql}\n`);
  }

  private async waitToken(token: string): Promise<string> {
    const started = Date.now();
    while (!this.stdout.includes(token)) {
      if (this.child.exitCode !== null) {
        const errorLine = this.stderr
          .split(/\r?\n/)
          .find((line) => /^(ERROR|FATAL|PANIC):/i.test(line));
        throw new Error(
          errorLine
            ? `PSQL_SESSION_FAILED ${errorLine.replace(/[^A-Z0-9_ :.=-]/gi, " ").slice(0, 80)}`
            : "PSQL_SESSION_FAILED",
        );
      }
      if (Date.now() - started > 120_000) {
        throw new Error("PSQL_SESSION_TIMEOUT");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const index = this.stdout.indexOf(token);
    const prefix = this.stdout.slice(0, index).trim();
    this.stdout = this.stdout.slice(index + token.length);
    return prefix;
  }

  async exec(sql: string): Promise<void> {
    const token = `OK_${randomBytes(4).toString("hex")}`;
    const trimmed = sql.trim();
    const body =
      trimmed.startsWith("\\") || trimmed.endsWith(";")
        ? trimmed
        : `${trimmed};`;
    this.write(`${body}\n\\echo ${token}\n`);
    await this.waitToken(token);
  }

  async query(sql: string): Promise<string> {
    const token = `OK_${randomBytes(4).toString("hex")}`;
    this.write(`${sql.endsWith(";") ? sql : `${sql};`}\n\\echo ${token}\n`);
    return await this.waitToken(token);
  }

  async end(sql: "commit" | "rollback"): Promise<void> {
    try {
      await this.exec(`${sql};`);
    } finally {
      this.child.stdin.end();
      await this.closed;
    }
  }

  async abort(): Promise<void> {
    if (this.child.exitCode === null) {
      this.child.stdin.end();
      this.child.kill("SIGTERM");
    }
    await this.closed;
  }
}

export function createLoopbackPsqlSession(input: {
  port: number;
  database: string;
  user: string;
  bin?: string;
}): PsqlRunnerSession {
  return new PsqlRunnerSession(
    ["-h", "127.0.0.1", "-p", String(input.port), "-U", input.user, "-d", input.database],
    { PGSSLMODE: "disable" },
    input.bin,
  );
}

export function createVerifiedRemotePsqlSession(dbUrl: string): PsqlRunnerSession {
  const parsed = parsePostgresUrl(dbUrl);
  const rootCert = existsSync("/etc/ssl/cert.pem")
    ? "/etc/ssl/cert.pem"
    : existsSync("/etc/ssl/certs/ca-certificates.crt")
      ? "/etc/ssl/certs/ca-certificates.crt"
      : "";
  if (!rootCert) {
    throw new Error(DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED);
  }
  return new PsqlRunnerSession(
    [
      "-h",
      parsed.hostname,
      "-p",
      String(parsed.port),
      "-U",
      parsed.user,
      "-d",
      parsed.database,
    ],
    {
      PGPASSWORD: parsed.password,
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: rootCert,
    },
  );
}

export async function runReadonlyPreflightOnSession(
  session: SqlSession,
): Promise<ReadonlyPreflightReport> {
  try {
    await session.exec(plannedReadonlyReconcilePrefix());
    const probe = parseReadonlyBoundaryProbe(
      await session.query(plannedReadonlyBoundaryProbeSql()),
    );
    if (!probe.serviceRole || !probe.readOnly) {
      await session.end("rollback");
      return {
        class: "READONLY_PREFLIGHT_FAILED",
        readonlyBoundary: false,
        roleSwitch: "ROLE_SWITCH_FAILED",
      };
    }
    const dbClass = await session.query(plannedCurrentDatabaseClassSql());
    const historyLine = await session.query(plannedHistoryIdentitySql());
    const [historyCount, historyVersion, historyName] = historyLine.split("|");
    const inventoryLine = await session.query(plannedRequiredCoreInventorySql());
    const [tables, fn, trigger, indexes, pgcrypto] = inventoryLine.split("|");
    const countLine = await session.query(plannedZeroCountSql());
    const [source, lexemes, relations, tags, learner] = countLine.split("|");
    let vocabOk = true;
    for (const table of VOCABULARY_TABLES) {
      const line = await session.query(plannedPrivilegeMatrixSql(table));
      vocabOk = vocabOk && classifyVocabPrivilegeLine(line);
    }
    let learnerOk = true;
    for (const table of LEARNER_TABLES) {
      const priv = await session.query(plannedPrivilegeMatrixSql(table));
      const rls = await session.query(plannedLearnerRlsSql(table));
      learnerOk =
        learnerOk &&
        classifyLearnerPrivilegeLine(priv) &&
        classifyLearnerRlsLine(rls);
    }
    const contaminationCount = Number(await session.query(plannedContaminationSql()));
    await session.end("rollback");
    const vocabularyZero =
      source === "0" && lexemes === "0" && relations === "0" && tags === "0";
    const learnerZero = learner === "0";
    const historyOk =
      historyCount === "1" &&
      historyVersion === "202609260001" &&
      historyName === "dedicated_wordranger_baseline_v0";
    const historyClass =
      historyName === "UNREADABLE" || historyVersion === "UNREADABLE"
        ? "HISTORY_UNREADABLE_AS_SERVICE_ROLE"
        : historyName === "ABSENT" || historyVersion === "ABSENT"
          ? "HISTORY_INFRASTRUCTURE_ABSENT"
          : historyOk
            ? "HISTORY_POSTCONDITION_VERIFIED"
            : "HISTORY_POSTCONDITION_FAILED";
    const coreOk =
      tables === "10" &&
      asBool(fn ?? "") &&
      asBool(trigger ?? "") &&
      indexes === "18" &&
      asBool(pgcrypto ?? "");
    return {
      class: "READONLY_PREFLIGHT_COMPLETE",
      currentDatabase:
        dbClass === CURRENT_DATABASE_PRESENT
          ? CURRENT_DATABASE_PRESENT
          : CURRENT_DATABASE_ABSENT,
      readonlyBoundary: true,
      roleSwitch: "ROLE_SWITCH_VERIFIED",
      history: {
        count: Number(historyCount),
        version: historyVersion === "202609260001" ? historyVersion : "REDACTED",
        name:
          historyName === "dedicated_wordranger_baseline_v0"
            ? historyName
            : "REDACTED",
        class: historyClass,
      },
      requiredCore: {
        tables: Number(tables),
        functionPresent: asBool(fn ?? ""),
        triggerPresent: asBool(trigger ?? ""),
        indexes: Number(indexes),
        pgcrypto: asBool(pgcrypto ?? ""),
        class: coreOk ? "COMPLETE" : "INCOMPLETE",
      },
      counts: {
        vocabularyZero,
        learnerZero,
        class:
          vocabularyZero && learnerZero
            ? "ALL_REQUIRED_TABLES_ZERO_ROWS"
            : "REQUIRED_TABLES_NOT_ZERO",
      },
      vocabularyPrivileges: vocabOk
        ? "VOCAB_SERVICE_ROLE_SUI_NO_DELETE"
        : "VOCAB_PRIVILEGE_MISMATCH",
      learnerSecurity: learnerOk
        ? "LEARNER_SERVICE_ROLE_DML_CLIENTS_DENIED"
        : "LEARNER_SECURITY_MISMATCH",
      contamination:
        contaminationCount === 0
          ? "SHARED_AND_OPTIONAL_OBJECTS_ABSENT"
          : "SHARED_OR_OPTIONAL_OBJECT_PRESENT",
    };
  } catch (error) {
    await session.abort();
    const detail =
      error instanceof Error ? error.message.slice(0, 80) : "UNKNOWN";
    return {
      class: "READONLY_PREFLIGHT_FAILED",
      failureKind: /PSQL_SESSION_FAILED|PSQL_BIN_MISSING|PSQL_SESSION_TIMEOUT/.test(
        detail,
      )
        ? detail.slice(0, 80)
        : "PREFLIGHT_EXCEPTION",
    };
  }
}

export async function runLocalDryRunRollback(
  session: SqlSession,
): Promise<{ class: "LOCAL_DRY_RUN_ROLLED_BACK" | "LOCAL_DRY_RUN_FAILED" }> {
  try {
    const rows = toVocabularyImportRows(loadVocabularyDataset());
    await session.exec(plannedTransactionPrefix());
    await session.exec(plannedInitialEmptyGuardSql());
    await session.exec(plannedVocabularyUpserts(rows));
    await session.exec(
      plannedCountAndLearnerGuardSql({
        sourceEntries: EXPECTED_SOURCE_ENTRIES,
        lexemes: EXPECTED_LEXEMES,
        relations: EXPECTED_RELATIONS,
        tags: EXPECTED_TAGS,
      }),
    );
    await session.end("rollback");
    return { class: "LOCAL_DRY_RUN_ROLLED_BACK" };
  } catch {
    await session.abort();
    return { class: "LOCAL_DRY_RUN_FAILED" };
  }
}

export function localContentReport(): {
  fingerprintVersion: typeof EXPECTED_FINGERPRINT_VERSION;
  fingerprint: string;
  sourceEntries: number;
  lexemes: number;
  relations: number;
  tags: number;
} {
  const rows = toVocabularyImportRows(loadVocabularyDataset());
  const printed = fingerprintVocabularyImportRows(rows);
  return {
    fingerprintVersion: EXPECTED_FINGERPRINT_VERSION,
    fingerprint: printed.fingerprint,
    sourceEntries: rows.sourceEntries.length,
    lexemes: rows.lexemes.length,
    relations: rows.relations.length,
    tags: rows.tags.length,
  };
}

export function validateLocalContent(): {
  class: "LOCAL_CONTENT_VALID" | "LOCAL_CONTENT_INVALID";
  report: ReturnType<typeof localContentReport>;
} {
  const report = localContentReport();
  const ok =
    report.fingerprint === EXPECTED_CONTENT_FINGERPRINT &&
    report.sourceEntries === EXPECTED_SOURCE_ENTRIES &&
    report.lexemes === EXPECTED_LEXEMES &&
    report.relations === EXPECTED_RELATIONS &&
    report.tags === EXPECTED_TAGS;
  return { class: ok ? "LOCAL_CONTENT_VALID" : "LOCAL_CONTENT_INVALID", report };
}

export interface DirectPostgresCliDeps {
  preflightSession?: () => Promise<SqlSession>;
  dryRunSession?: () => Promise<SqlSession>;
  readSnapshotFile?: (file: string) => string;
  proveTls?: typeof proveDirectDbTlsIdentity;
  connectRemote?: (dbUrl: string) => Promise<SqlSession>;
}

function ambientCredentialKeys(env: Record<string, string | undefined>): string[] {
  return DENIED_AMBIENT.filter((key) => Object.hasOwn(env, key));
}

export async function runTransactionalDirectPostgresCli(
  argv: string[],
  env: Record<string, string | undefined> = {},
  io: DirectPostgresCliIo = {
    log: (value) => console.log(value),
    error: (value) => console.error(value),
  },
  deps: DirectPostgresCliDeps = {},
): Promise<DirectPostgresCliResult> {
  const mode = parseDirectPostgresCliMode(argv);
  if (mode === "apply" || applyBypassRejected(env) && argv.includes("--apply")) {
    const className = refuseDirectPostgresApply();
    io.error(JSON.stringify({ class: className, mode: "apply" }));
    return { exitCode: 1, mode: "apply", class: className };
  }
  if (applyBypassRejected(env) && mode !== "apply") {
    // Bypass env cannot authorize apply; other modes still run.
  }

  if (mode === "fingerprint") {
    const report = localContentReport();
    io.log(JSON.stringify({ mode, ...report }, null, 2));
    return { exitCode: 0, mode, class: "FINGERPRINT_PRINTED" };
  }

  if (mode === "validate") {
    const validated = validateLocalContent();
    io.log(JSON.stringify({ mode, ...validated }, null, 2));
    return {
      exitCode: validated.class === "LOCAL_CONTENT_VALID" ? 0 : 1,
      mode,
      class: validated.class,
    };
  }

  if (mode === "dry-run") {
    if (flagValue(argv, "--credential-snapshot") || deps.connectRemote) {
      io.error(JSON.stringify({ class: REMOTE_DRY_RUN_NOT_AUTHORIZED }));
      return {
        exitCode: 1,
        mode,
        class: REMOTE_DRY_RUN_NOT_AUTHORIZED,
      };
    }
    const validated = validateLocalContent();
    if (validated.class !== "LOCAL_CONTENT_VALID") {
      io.error(JSON.stringify({ mode, ...validated }));
      return { exitCode: 1, mode, class: validated.class };
    }
    if (deps.dryRunSession) {
      const session = await deps.dryRunSession();
      const result = await runLocalDryRunRollback(session);
      io.log(JSON.stringify({ mode, ...validated, ...result }, null, 2));
      return {
        exitCode: result.class === "LOCAL_DRY_RUN_ROLLED_BACK" ? 0 : 1,
        mode,
        class: result.class,
      };
    }
    io.log(
      JSON.stringify(
        {
          mode,
          ...validated,
          class: "DRY_RUN_PLAN_ONLY",
          commit: false,
          remote: REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
        },
        null,
        2,
      ),
    );
    return { exitCode: 0, mode, class: "DRY_RUN_PLAN_ONLY" };
  }

  const leaked = ambientCredentialKeys(env);
  const snapshotPath = flagValue(argv, "--credential-snapshot");
  if (deps.preflightSession) {
    const session = await deps.preflightSession();
    const report = await runReadonlyPreflightOnSession(session);
    io.log(JSON.stringify({ mode, ...report }, null, 2));
    return {
      exitCode: report.class === "READONLY_PREFLIGHT_COMPLETE" ? 0 : 1,
      mode,
      class: report.class,
    };
  }
  if (!snapshotPath) {
    io.error(
      JSON.stringify({
        class: CREDENTIAL_SOURCE_REJECTED,
        reason: "SNAPSHOT_REQUIRED",
      }),
    );
    return { exitCode: 1, mode, class: CREDENTIAL_SOURCE_REJECTED };
  }
  if (leaked.length > 0) {
    io.error(JSON.stringify({ class: CREDENTIAL_SOURCE_REJECTED, reason: "AMBIENT" }));
    return { exitCode: 1, mode, class: CREDENTIAL_SOURCE_REJECTED };
  }
  if (snapshotPath.includes(".env.local") || snapshotPath.includes("supabase/.temp")) {
    io.error(JSON.stringify({ class: CREDENTIAL_SOURCE_REJECTED, reason: "FORBIDDEN_SOURCE" }));
    return { exitCode: 1, mode, class: CREDENTIAL_SOURCE_REJECTED };
  }
  const reader = deps.readSnapshotFile ?? ((file: string) => readFileSync(file, "utf8"));
  const snapshot = parseSnapshotEnvFile(reader(snapshotPath));
  const identity = classifySnapshotIdentity({
    snapshot,
    envLocal: false,
    ambient: false,
    linked: false,
    composedFromRest: false,
  });
  if ("pooled" in identity) {
    io.error(
      JSON.stringify({
        class: identity.pooled,
        credentialSource: identity.credentialSource,
        dedicatedTarget: identity.dedicatedTarget,
        tls: "SQL_NOT_ATTEMPTED",
      }),
    );
    return { exitCode: 1, mode, class: identity.pooled };
  }
  if (!("dbUrl" in identity)) {
    io.error(JSON.stringify({ class: CREDENTIAL_SOURCE_REJECTED }));
    return { exitCode: 1, mode, class: CREDENTIAL_SOURCE_REJECTED };
  }
  const parsed = parsePostgresUrl(identity.dbUrl);
  if (parsed.sslmode === "disable") {
    io.error(JSON.stringify({ class: REMOTE_TLS_REJECTED }));
    return { exitCode: 1, mode, class: REMOTE_TLS_REJECTED };
  }
  const prove = deps.proveTls ?? proveDirectDbTlsIdentity;
  const tlsClass = await prove({ hostname: parsed.hostname, port: parsed.port });
  if (tlsClass.class !== REMOTE_TLS_VERIFIED) {
    io.error(JSON.stringify({ class: tlsClass.class }));
    return { exitCode: 1, mode, class: tlsClass.class };
  }
  const connect = deps.connectRemote ?? createVerifiedRemotePsqlSession;
  const session = await Promise.resolve(connect(identity.dbUrl));
  const report = await runReadonlyPreflightOnSession(session);
  io.log(
    JSON.stringify(
      {
        mode,
        credentialSource: identity.credentialSource,
        dedicatedTarget: identity.dedicatedTarget,
        tls: tlsClass.class,
        ...report,
      },
      null,
      2,
    ),
  );
  return {
    exitCode: report.class === "READONLY_PREFLIGHT_COMPLETE" ? 0 : 1,
    mode,
    class: report.class,
  };
}

export function attachDirectPostgresCliHandler(
  work: Promise<DirectPostgresCliResult>,
  io: DirectPostgresCliIo = {
    log: (value) => console.log(value),
    error: (value) => console.error(value),
  },
): Promise<void> {
  return work.then(
    (result) => {
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    },
    (error: unknown) => {
      process.exitCode = 1;
      io.error(
        JSON.stringify({
          class: "RUNNER_FAILED",
          summary: error instanceof Error ? error.name : "UNKNOWN",
        }),
      );
    },
  );
}
