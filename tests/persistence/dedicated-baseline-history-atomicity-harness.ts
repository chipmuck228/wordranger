import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

export const SPIKE_CLI_VERSION = "2.118.0";
export const SPIKE_BASELINE_VERSION = "202609260001";
export const SPIKE_PROBE_TABLE = "public.spike_probe";
export const HISTORY_TABLE = "supabase_migrations.schema_migrations";
export const HISTORY_FAIL_MESSAGE = "SPIKE_HISTORY_INSERT_REJECTED";
export const FORMAL_BASELINE_PATH =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
export const FORMAL_BASELINE_FILE = "202609260001_dedicated_wordranger_baseline_v0.sql";
export const FORMAL_BASELINE_NAME = "dedicated_wordranger_baseline_v0";
export const FORMAL_BASELINE_SHA256 =
  "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe";
export const PREVIOUS_AUTHORED_TX_BASELINE_SHA256 =
  "0ca22a8adba187ad4cc9255d357ab4c9da94dbc2e0a401fe65e6afc73e096b35";

export const REQUIRED_CORE_TABLES = [
  "public.vocabulary_source_entries",
  "public.lexemes",
  "public.lexeme_relations",
  "public.lexeme_tags",
  "public.learning_tasks",
  "public.game_sessions",
  "public.learning_evidence",
  "public.student_lexeme_models",
  "public.student_lexeme_skill_states",
  "public.student_lexeme_weaknesses",
] as const;

export const REQUIRED_FUNCTIONS = ["public.prevent_learning_evidence_mutation"] as const;
export const REQUIRED_TRIGGERS = ["learning_evidence_no_update"] as const;
export const REQUIRED_INDEXES = [
  "lexemes_lemma_idx",
  "lexemes_source_entry_id_idx",
  "lexemes_source_index_idx",
  "student_lexeme_models_user_id_idx",
  "student_lexeme_models_lexeme_id_idx",
  "student_lexeme_models_next_review_at_idx",
  "student_lexeme_models_mastery_stage_idx",
  "student_lexeme_weaknesses_model_idx",
  "learning_tasks_lexeme_id_idx",
  "learning_tasks_user_id_idx",
  "game_sessions_user_id_idx",
  "game_sessions_game_type_idx",
  "game_sessions_updated_at_idx",
  "learning_evidence_user_lexeme_occurred_idx",
  "learning_evidence_session_id_idx",
  "learning_evidence_skill_idx",
  "learning_evidence_outcome_idx",
  "learning_evidence_task_id_uidx",
] as const;

export type SchemaState = "ABSENT" | "COMPLETE" | "PARTIAL";
export type ApplyState = "ABSENT" | "COMPLETE" | "PARTIAL";
export type ApplyCommand = "db-push" | "migration-up";
export type TransactionShape = "authored-begin-commit" | "no-authored-transaction";
export type CaseId = "A-success" | "B-schema-fail" | "C-history-fail";

export interface HistoryRow {
  version: string;
  name: string;
  statements: string[];
}

export interface TeardownEvidence {
  clusterStopped: boolean;
  portClosed: boolean;
  clusterRemoved: boolean;
  fixtureWorkdirsRemoved: boolean;
}

export interface FormalSchemaObservation {
  listenAddresses: string;
  serverAddr: string;
  presentTables: string[];
  missingTables: string[];
  presentFunctions: string[];
  presentTriggers: string[];
  presentIndexes: string[];
  missingIndexes: string[];
  extensionPresent: boolean;
  historyInfrastructurePresent: boolean;
  historyRows: HistoryRow[];
  baselineHistoryPresent: boolean;
  schemaState: SchemaState;
}

export interface SchemaHistoryState {
  listenAddresses: string;
  serverAddr: string;
  probeTableExists: boolean;
  historyInfrastructurePresent: boolean;
  historyRows: HistoryRow[];
  schemaState: SchemaState;
}

export interface CaseResult {
  caseId: CaseId;
  shape: TransactionShape;
  command: ApplyCommand;
  database: string;
  version: string;
  cliExitCode: number;
  cliFailed: boolean;
  cliTail: string;
  after: SchemaHistoryState;
}

export interface SpikeRunSummary {
  cliVersion: string;
  postgresVersion: string;
  host: string;
  port: number;
  cases: CaseResult[];
  teardown: TeardownEvidence;
}

export interface FormalCaseResult {
  caseId: CaseId;
  command: ApplyCommand;
  cliExitCode: number;
  cliFailed: boolean;
  cliTail: string;
  dryRunTail: string;
  listedMigrationFiles: string[];
  after: FormalSchemaObservation;
}

export interface FormalSpikeSummary {
  cliVersion: string;
  postgresVersion: string;
  host: string;
  port: number;
  cases: FormalCaseResult[];
  teardown: TeardownEvidence;
}

export interface DisposablePostgres {
  host: "127.0.0.1";
  port: number;
  postgresVersion: string;
  createDatabase: () => string;
  teardown: (fixtureWorkdirsRemoved?: boolean) => Promise<TeardownEvidence>;
}

const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const ALLOWED_PARENT_ENV = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL"] as const;
const DENIED_ENV =
  /^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|POSTGRES_|VERCEL_|DATABASE_URL|DIRECT_URL|PGHOST|PGHOSTADDR|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PGSERVICE|PGSERVICEFILE|PGPASSFILE|PGSSLMODE|PGOPTIONS|PGAPPNAME|PGREQUIRESSL|PGSSLROOTCERT)/i;
const ARCHIVE_MIGRATION_MARKERS = [
  "202609250001",
  "migrations_archive",
  "pre_dedicated_baseline",
];
const PG_BIN_CANDIDATES = [
  "/opt/homebrew/opt/postgresql@16/bin",
  "/opt/homebrew/bin",
  "/usr/lib/postgresql/16/bin",
  "/usr/bin",
];

const SCHEMA_SUCCESS = `create table public.spike_probe (
  id integer primary key
);
`;

const SCHEMA_FAIL = `create table public.spike_probe (
  id integer primary key
);
select 1 / 0;
`;

const HISTORY_FAIL_SETUP = `
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  name text,
  statements text[]
);
create or replace function supabase_migrations.spike_reject_history()
returns trigger
language plpgsql
as $$
begin
  raise exception '${HISTORY_FAIL_MESSAGE}' using errcode = 'check_violation';
end;
$$;
drop trigger if exists spike_reject_history on supabase_migrations.schema_migrations;
create trigger spike_reject_history
  before insert on supabase_migrations.schema_migrations
  for each row
  execute function supabase_migrations.spike_reject_history();
`;

const FORMAL_ROLE_SETUP = `
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin nosuperuser noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin nosuperuser noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin nosuperuser noinherit;
  end if;
end
$$;
`;

export function findPostgresBin(name: string): string | null {
  for (const dir of PG_BIN_CANDIDATES) {
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function postgresHarnessAvailable(): boolean {
  return (
    findPostgresBin("initdb") !== null &&
    findPostgresBin("pg_ctl") !== null &&
    findPostgresBin("psql") !== null &&
    findPostgresBin("createdb") !== null
  );
}

export function buildChildEnv(
  extra: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};
  for (const key of ALLOWED_PARENT_ENV) {
    const value = process.env[key];
    if (value !== undefined && !DENIED_ENV.test(key)) {
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || DENIED_ENV.test(key)) continue;
    env[key] = value;
  }
  return env as NodeJS.ProcessEnv;
}

export function readInstalledCliVersion(): string {
  const result = spawnSync("npx", ["supabase", "--version"], {
    encoding: "utf8",
    env: buildChildEnv({ npm_config_yes: "true" }),
  });
  return (result.stdout || result.stderr).trim();
}

export function assertLocalDbUrl(dbUrl: string, expectedPort?: number): string {
  if (dbUrl.includes(",") || /@[^/?#]*,/.test(dbUrl)) {
    throw new Error("refusing non-local DB URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error("refusing non-local DB URL");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("refusing non-local DB URL");
  }
  if (parsed.hash) {
    throw new Error("refusing non-local DB URL");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!LOCAL_DB_HOSTS.has(host) || host.startsWith("/")) {
    throw new Error("refusing non-local DB URL");
  }
  if (!parsed.port) {
    throw new Error("refusing non-local DB URL");
  }
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("refusing non-local DB URL");
  }
  if (expectedPort !== undefined && port !== expectedPort) {
    throw new Error("refusing non-local DB URL");
  }
  const params = [...parsed.searchParams.entries()];
  if (params.length !== 1 || params[0]?.[0] !== "sslmode" || params[0]?.[1] !== "disable") {
    throw new Error("refusing non-local DB URL");
  }
  return dbUrl;
}

function wrapSql(shape: TransactionShape, body: string): string {
  const trimmed = body.trim();
  if (shape === "authored-begin-commit") {
    return `begin;\n\n${trimmed}\n\ncommit;\n`;
  }
  return `${trimmed}\n`;
}

function unusedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("failed to allocate a localhost port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function randomToken(bytes = 6): string {
  return randomBytes(bytes).toString("hex");
}

function requireBin(name: string): string {
  const bin = findPostgresBin(name);
  if (!bin) throw new Error(`missing local PostgreSQL binary: ${name}`);
  return bin;
}

function execPg(binName: string, args: string[]): string {
  const result = spawnSync(requireBin(binName), args, {
    encoding: "utf8",
    env: buildChildEnv(),
  });
  if (result.status !== 0) {
    throw new Error(
      `${binName} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return (result.stdout || "").trim();
}

function localDbUrl(port: number, database: string): string {
  return assertLocalDbUrl(
    `postgresql://spike@127.0.0.1:${port}/${database}?sslmode=disable`,
    port,
  );
}

function psql(port: number, database: string, sql: string): string {
  return execPg("psql", [
    "-h",
    "127.0.0.1",
    "-p",
    String(port),
    "-U",
    "spike",
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    sql,
  ]);
}

function parseHistoryRows(raw: string): HistoryRow[] {
  const parsed = JSON.parse(raw.length > 0 ? raw : "[]") as Array<{
    version?: unknown;
    name?: unknown;
    statements?: unknown;
  }>;
  return parsed.map((row) => ({
    version: String(row.version ?? ""),
    name: String(row.name ?? ""),
    statements: Array.isArray(row.statements) ? row.statements.map((entry) => String(entry)) : [],
  }));
}

function readHistory(port: number, database: string, historyExists: boolean): HistoryRow[] {
  if (!historyExists) return [];
  const raw = psql(
    port,
    database,
    "select coalesce(json_agg(json_build_object('version', version, 'name', coalesce(name, ''), 'statements', statements) order by version)::text, '[]') from supabase_migrations.schema_migrations;",
  );
  return parseHistoryRows(raw);
}

function observeToy(port: number, database: string): SchemaHistoryState {
  const raw = psql(
    port,
    database,
    `select json_build_object(
      'listen', current_setting('listen_addresses'),
      'server', coalesce(inet_server_addr()::text, ''),
      'probe', to_regclass('${SPIKE_PROBE_TABLE}') is not null,
      'history', to_regclass('${HISTORY_TABLE}') is not null
    )::text;`,
  );
  const parsed = JSON.parse(raw) as {
    listen?: string;
    server?: string;
    probe?: boolean;
    history?: boolean;
  };
  const probeTableExists = parsed.probe === true;
  return {
    listenAddresses: String(parsed.listen ?? ""),
    serverAddr: String(parsed.server ?? ""),
    probeTableExists,
    historyInfrastructurePresent: parsed.history === true,
    historyRows: readHistory(port, database, parsed.history === true),
    schemaState: probeTableExists ? "COMPLETE" : "ABSENT",
  };
}

function sqlInList(values: readonly string[], quote: (value: string) => string): string {
  return values.map(quote).join(", ");
}

function observeFormal(port: number, database: string): FormalSchemaObservation {
  const tableList = sqlInList(REQUIRED_CORE_TABLES, (value) => `'${value}'`);
  const indexList = sqlInList(REQUIRED_INDEXES, (value) => `'${value}'`);
  const raw = psql(
    port,
    database,
    `select json_build_object(
      'listen', current_setting('listen_addresses'),
      'server', coalesce(inet_server_addr()::text, ''),
      'tables', coalesce((
        select json_agg(n.nspname || '.' || c.relname order by 1)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r'
          and (n.nspname || '.' || c.relname) in (${tableList})
      ), '[]'::json),
      'functions', coalesce((
        select json_agg(n.nspname || '.' || p.proname order by 1)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname || '.' || p.proname = 'public.prevent_learning_evidence_mutation'
      ), '[]'::json),
      'triggers', coalesce((
        select json_agg(t.tgname order by 1)
        from pg_trigger t
        where not t.tgisinternal and t.tgname = 'learning_evidence_no_update'
      ), '[]'::json),
      'indexes', coalesce((
        select json_agg(c.relname order by 1)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'i' and c.relname in (${indexList})
      ), '[]'::json),
      'extension', exists(select 1 from pg_extension where extname = 'pgcrypto'),
      'history', to_regclass('${HISTORY_TABLE}') is not null
    )::text;`,
  );
  const parsed = JSON.parse(raw) as {
    listen?: string;
    server?: string;
    tables?: string[];
    functions?: string[];
    triggers?: string[];
    indexes?: string[];
    extension?: boolean;
    history?: boolean;
  };
  const presentTables = (parsed.tables ?? []).slice().sort();
  const presentFunctions = (parsed.functions ?? []).slice().sort();
  const presentTriggers = (parsed.triggers ?? []).slice().sort();
  const presentIndexes = (parsed.indexes ?? []).slice().sort();
  const missingTables = REQUIRED_CORE_TABLES.filter((table) => !presentTables.includes(table));
  const missingIndexes = REQUIRED_INDEXES.filter((index) => !presentIndexes.includes(index));
  const extensionPresent = parsed.extension === true;
  const historyInfrastructurePresent = parsed.history === true;
  const historyRows = readHistory(port, database, historyInfrastructurePresent);
  const nonePresent =
    presentTables.length === 0 &&
    presentFunctions.length === 0 &&
    presentTriggers.length === 0 &&
    presentIndexes.length === 0 &&
    !extensionPresent;
  const allPresent =
    missingTables.length === 0 &&
    presentFunctions.length === REQUIRED_FUNCTIONS.length &&
    presentTriggers.length === REQUIRED_TRIGGERS.length &&
    missingIndexes.length === 0 &&
    extensionPresent;
  let schemaState: SchemaState = "PARTIAL";
  if (allPresent) schemaState = "COMPLETE";
  else if (nonePresent) schemaState = "ABSENT";
  return {
    listenAddresses: String(parsed.listen ?? ""),
    serverAddr: String(parsed.server ?? ""),
    presentTables,
    missingTables: [...missingTables],
    presentFunctions,
    presentTriggers,
    presentIndexes,
    missingIndexes: [...missingIndexes],
    extensionPresent,
    historyInfrastructurePresent,
    historyRows,
    baselineHistoryPresent: historyRows.some((row) => row.version === SPIKE_BASELINE_VERSION),
    schemaState,
  };
}

function writeFixtureWorkdir(
  root: string,
  version: string,
  name: string,
  shape: TransactionShape,
  body: string,
): string {
  const migrationsDir = path.join(root, "supabase", "migrations");
  mkdirSync(migrationsDir, { recursive: true });
  writeFileSync(
    path.join(root, "supabase", "config.toml"),
    [
      "# Disposable spike fixture. Not a Supabase remote project.",
      "[api]",
      "enabled = false",
      "",
    ].join("\n"),
  );
  const fileName = `${version}_${name}.sql`;
  writeFileSync(path.join(migrationsDir, fileName), wrapSql(shape, body));
  return fileName;
}

function writeFormalFixture(root: string, mutate?: (sql: string) => string): string[] {
  const source = readFileSync(path.join(process.cwd(), FORMAL_BASELINE_PATH), "utf8");
  const migrationsDir = path.join(root, "supabase", "migrations");
  mkdirSync(migrationsDir, { recursive: true });
  writeFileSync(
    path.join(root, "supabase", "config.toml"),
    [
      "# Disposable formal-baseline fixture. Not a Supabase remote project.",
      "[api]",
      "enabled = false",
      "",
    ].join("\n"),
  );
  writeFileSync(path.join(migrationsDir, FORMAL_BASELINE_FILE), mutate ? mutate(source) : source);
  if (existsSync(path.join(root, "supabase", "migrations_archive"))) {
    throw new Error("formal fixture must not contain migrations_archive");
  }
  return readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
}

function applyCli(
  command: ApplyCommand,
  workdir: string,
  dbUrl: string,
  extra: string[] = [],
): Promise<{ exitCode: number; tail: string }> {
  const args =
    command === "db-push"
      ? ["db", "push", "--db-url", dbUrl, "--yes", "--skip-vault", "--workdir", workdir, ...extra]
      : ["migration", "up", "--db-url", dbUrl, "--yes", "--workdir", workdir, ...extra];
  return new Promise((resolve) => {
    const child = spawn("npx", ["supabase", ...args], {
      cwd: workdir,
      env: buildChildEnv({ npm_config_yes: "true" }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("close", (code) => {
      const combined = `${Buffer.concat(stdout).toString("utf8")}\n${Buffer.concat(stderr).toString("utf8")}`.trim();
      resolve({
        exitCode: code ?? 1,
        tail: combined.split(/\r?\n/u).slice(-24).join("\n"),
      });
    });
    child.on("error", (error) => {
      resolve({ exitCode: 1, tail: error.message });
    });
  });
}

function removeDirConfirmed(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  if (existsSync(dir)) {
    throw new Error(`failed to remove disposable directory`);
  }
}

function postmasterPid(clusterDir: string): number | null {
  const pidFile = path.join(clusterDir, "postmaster.pid");
  if (!existsSync(pidFile)) return null;
  const pid = Number(readFileSync(pidFile, "utf8").split("\n")[0]);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(250);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function stopCluster(clusterDir: string): Omit<TeardownEvidence, "fixtureWorkdirsRemoved"> {
  const pid = postmasterPid(clusterDir);
  const stop = spawnSync(requireBin("pg_ctl"), ["-D", clusterDir, "-m", "fast", "-w", "stop"], {
    encoding: "utf8",
    env: buildChildEnv(),
  });
  const stillRunning = pid !== null && processExists(pid);
  if (stop.status !== 0 && stillRunning) {
    throw new Error(`pg_ctl stop failed with exit ${stop.status ?? "null"}`);
  }
  if (stillRunning) {
    throw new Error("postmaster PID still running after pg_ctl stop");
  }
  return {
    clusterStopped: !stillRunning,
    portClosed: true,
    clusterRemoved: false,
  };
}

async function teardownCluster(
  clusterDir: string,
  port: number,
  fixtureWorkdirsRemoved: boolean,
): Promise<TeardownEvidence> {
  const stopped = stopCluster(clusterDir);
  const portOpen = await portIsOpen(port);
  if (portOpen) {
    throw new Error("harness port still open after pg_ctl stop");
  }
  removeDirConfirmed(clusterDir);
  return {
    clusterStopped: stopped.clusterStopped,
    portClosed: !portOpen,
    clusterRemoved: !existsSync(clusterDir),
    fixtureWorkdirsRemoved,
  };
}

export async function startDisposablePostgres(): Promise<DisposablePostgres> {
  if (!postgresHarnessAvailable()) {
    throw new Error("local PostgreSQL 16 binaries are not available");
  }
  const port = await unusedPort();
  const clusterDir = mkdtempSync(path.join(tmpdir(), "wr-baseline-atomicity-"));
  execPg("initdb", [
    "-D",
    clusterDir,
    "-U",
    "spike",
    "--auth-local=trust",
    "--auth-host=trust",
    "--encoding=UTF8",
    "--locale=C",
    "--no-instructions",
  ]);
  const confPath = path.join(clusterDir, "postgresql.conf");
  writeFileSync(
    confPath,
    `${readFileSync(confPath, "utf8")}\nlisten_addresses = '127.0.0.1'\nport = ${port}\nunix_socket_directories = '${clusterDir}'\nfsync = off\nsynchronous_commit = off\nfull_page_writes = off\n`,
  );
  execPg("pg_ctl", ["-D", clusterDir, "-l", path.join(clusterDir, "pg.log"), "-w", "start"]);
  const postgresVersion = psql(port, "template1", "show server_version;");
  let tornDown = false;
  const handle: DisposablePostgres = {
    host: "127.0.0.1",
    port,
    postgresVersion,
    createDatabase: () => {
      const database = `spike_${randomToken()}`;
      execPg("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "spike", database]);
      return database;
    },
    teardown: async (fixtureWorkdirsRemoved = true) => {
      if (tornDown) {
        return {
          clusterStopped: true,
          portClosed: !(await portIsOpen(port)),
          clusterRemoved: !existsSync(clusterDir),
          fixtureWorkdirsRemoved,
        };
      }
      tornDown = true;
      return teardownCluster(clusterDir, port, fixtureWorkdirsRemoved);
    },
  };
  return handle;
}

export async function withDisposablePostgres<T>(
  run: (ctx: DisposablePostgres) => Promise<T>,
): Promise<{ result: T; teardown: TeardownEvidence }> {
  const postgres = await startDisposablePostgres();
  let runError: unknown;
  let result: T | undefined;
  try {
    result = await run(postgres);
  } catch (error) {
    runError = error;
  }
  let teardown: TeardownEvidence | undefined;
  let cleanupError: unknown;
  try {
    teardown = await postgres.teardown(true);
  } catch (error) {
    cleanupError = error;
  }
  if (runError && cleanupError) {
    throw new Error(
      `${runError instanceof Error ? runError.message : String(runError)}; cleanup: ${
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
      }`,
    );
  }
  if (runError) throw runError;
  if (cleanupError) throw cleanupError;
  if (teardown === undefined || result === undefined) {
    throw new Error("disposable postgres finished without a result or teardown evidence");
  }
  return { result, teardown };
}

function removeFixture(workdir: string): void {
  removeDirConfirmed(workdir);
}

export function classifyCase(result: CaseResult): {
  schemaState: SchemaState;
  applyState: ApplyState;
  historyPresent: boolean;
  historyInfrastructurePresent: boolean;
  exactlyOneHistoryRow: boolean;
} {
  const historyPresent = result.after.historyRows.some((row) => row.version === result.version);
  const schemaState = result.after.schemaState;
  let applyState: ApplyState = "PARTIAL";
  if (schemaState === "COMPLETE" && historyPresent && result.after.historyRows.length === 1) {
    applyState = "COMPLETE";
  } else if (schemaState === "ABSENT" && !historyPresent) {
    applyState = "ABSENT";
  }
  return {
    schemaState,
    applyState,
    historyPresent,
    historyInfrastructurePresent: result.after.historyInfrastructurePresent,
    exactlyOneHistoryRow: result.after.historyRows.length === 1 && historyPresent,
  };
}

export function classifyFormalCase(result: FormalCaseResult): {
  schemaState: SchemaState;
  applyState: ApplyState;
  historyPresent: boolean;
  historyInfrastructurePresent: boolean;
  exactlyOneHistoryRow: boolean;
  leftovers: string[];
} {
  const { after } = result;
  const leftovers = [
    ...after.presentTables.map((name) => `table:${name}`),
    ...after.presentFunctions.map((name) => `function:${name}`),
    ...after.presentTriggers.map((name) => `trigger:${name}`),
    ...after.presentIndexes.map((name) => `index:${name}`),
    ...(after.extensionPresent ? ["extension:pgcrypto"] : []),
  ];
  let applyState: ApplyState = "PARTIAL";
  if (
    after.schemaState === "COMPLETE" &&
    after.baselineHistoryPresent &&
    after.historyRows.length === 1
  ) {
    applyState = "COMPLETE";
  } else if (after.schemaState === "ABSENT" && !after.baselineHistoryPresent) {
    applyState = "ABSENT";
  }
  return {
    schemaState: after.schemaState,
    applyState,
    historyPresent: after.baselineHistoryPresent,
    historyInfrastructurePresent: after.historyInfrastructurePresent,
    exactlyOneHistoryRow: after.historyRows.length === 1 && after.baselineHistoryPresent,
    leftovers: after.schemaState === "ABSENT" ? [] : leftovers,
  };
}

export function leftoverReport(result: FormalCaseResult): string {
  const classified = classifyFormalCase(result);
  return [
    `schemaState=${classified.schemaState}`,
    `applyState=${classified.applyState}`,
    `tables=${result.after.presentTables.join(",")}`,
    `missingTables=${result.after.missingTables.join(",")}`,
    `functions=${result.after.presentFunctions.join(",")}`,
    `triggers=${result.after.presentTriggers.join(",")}`,
    `indexes=${result.after.presentIndexes.join(",")}`,
    `extension=${result.after.extensionPresent}`,
    `historyInfrastructure=${result.after.historyInfrastructurePresent}`,
    `baselineHistory=${result.after.baselineHistoryPresent}`,
  ].join(" ");
}

export async function runAtomicitySpike(options?: {
  commands?: ApplyCommand[];
  postgres?: DisposablePostgres;
}): Promise<SpikeRunSummary> {
  const commands = options?.commands ?? ["db-push", "migration-up"];
  const cliVersion = readInstalledCliVersion();
  const run = async (postgres: DisposablePostgres): Promise<Omit<SpikeRunSummary, "teardown">> => {
    const cases: CaseResult[] = [];
    const shapes: TransactionShape[] = ["authored-begin-commit", "no-authored-transaction"];
    const matrix: Array<{
      caseId: CaseId;
      body: string;
      injectHistoryFailure: boolean;
      versionPrefix: string;
      name: string;
    }> = [
      {
        caseId: "A-success",
        body: SCHEMA_SUCCESS,
        injectHistoryFailure: false,
        versionPrefix: "20260926991",
        name: "spike_success",
      },
      {
        caseId: "B-schema-fail",
        body: SCHEMA_FAIL,
        injectHistoryFailure: false,
        versionPrefix: "20260926992",
        name: "spike_schema_fail",
      },
      {
        caseId: "C-history-fail",
        body: SCHEMA_SUCCESS,
        injectHistoryFailure: true,
        versionPrefix: "20260926993",
        name: "spike_history_fail",
      },
    ];
    let serial = 0;
    const workdirs: string[] = [];
    for (const command of commands) {
      for (const shape of shapes) {
        for (const spec of matrix) {
          serial += 1;
          const database = postgres.createDatabase();
          const version = `${spec.versionPrefix}${String(serial).padStart(2, "0")}`;
          const workdir = mkdtempSync(path.join(tmpdir(), "wr-spike-fixture-"));
          workdirs.push(workdir);
          try {
            writeFixtureWorkdir(workdir, version, spec.name, shape, spec.body);
            if (spec.injectHistoryFailure) {
              psql(postgres.port, database, HISTORY_FAIL_SETUP);
            }
            const applied = await applyCli(command, workdir, localDbUrl(postgres.port, database));
            await yieldEventLoop();
            cases.push({
              caseId: spec.caseId,
              shape,
              command,
              database,
              version,
              cliExitCode: applied.exitCode,
              cliFailed: applied.exitCode !== 0,
              cliTail: applied.tail,
              after: observeToy(postgres.port, database),
            });
          } finally {
            removeFixture(workdir);
          }
        }
      }
    }
    if (workdirs.some((dir) => existsSync(dir))) {
      throw new Error("spike fixture workdir remained after cleanup");
    }
    return {
      cliVersion,
      postgresVersion: postgres.postgresVersion,
      host: postgres.host,
      port: postgres.port,
      cases,
    };
  };

  if (options?.postgres) {
    const result = await run(options.postgres);
    return {
      ...result,
      teardown: {
        clusterStopped: false,
        portClosed: false,
        clusterRemoved: false,
        fixtureWorkdirsRemoved: true,
      },
    };
  }
  const wrapped = await withDisposablePostgres(run);
  return { ...wrapped.result, teardown: wrapped.teardown };
}

export async function runFormalBaselineAtomicityMatrix(options?: {
  commands?: ApplyCommand[];
  postgres?: DisposablePostgres;
}): Promise<FormalSpikeSummary> {
  const commands = options?.commands ?? ["db-push", "migration-up"];
  const cliVersion = readInstalledCliVersion();
  const run = async (postgres: DisposablePostgres): Promise<Omit<FormalSpikeSummary, "teardown">> => {
    const cases: FormalCaseResult[] = [];
    const specs: Array<{
      caseId: CaseId;
      injectHistoryFailure: boolean;
      mutate?: (sql: string) => string;
    }> = [
      { caseId: "A-success", injectHistoryFailure: false },
      {
        caseId: "B-schema-fail",
        injectHistoryFailure: false,
        mutate: (sql) => `${sql.trimEnd()}\n\nselect 1 / 0;\n`,
      },
      { caseId: "C-history-fail", injectHistoryFailure: true },
    ];
    const workdirs: string[] = [];
    for (const command of commands) {
      for (const spec of specs) {
        const database = postgres.createDatabase();
        const workdir = mkdtempSync(path.join(tmpdir(), "wr-formal-baseline-"));
        workdirs.push(workdir);
        try {
          const listedMigrationFiles = writeFormalFixture(workdir, spec.mutate);
          psql(postgres.port, database, FORMAL_ROLE_SETUP);
          if (spec.injectHistoryFailure) {
            psql(postgres.port, database, HISTORY_FAIL_SETUP);
          }
          const dbUrl = localDbUrl(postgres.port, database);
          const dryRun =
            command === "db-push"
              ? await applyCli(command, workdir, dbUrl, ["--dry-run"])
              : { exitCode: 0, tail: "" };
          await yieldEventLoop();
          const applied = await applyCli(command, workdir, dbUrl);
          await yieldEventLoop();
          cases.push({
            caseId: spec.caseId,
            command,
            cliExitCode: applied.exitCode,
            cliFailed: applied.exitCode !== 0,
            cliTail: applied.tail,
            dryRunTail: dryRun.tail,
            listedMigrationFiles,
            after: observeFormal(postgres.port, database),
          });
        } finally {
          removeFixture(workdir);
        }
      }
    }
    if (workdirs.some((dir) => existsSync(dir))) {
      throw new Error("formal fixture workdir remained after cleanup");
    }
    return {
      cliVersion,
      postgresVersion: postgres.postgresVersion,
      host: postgres.host,
      port: postgres.port,
      cases,
    };
  };

  if (options?.postgres) {
    const result = await run(options.postgres);
    return {
      ...result,
      teardown: {
        clusterStopped: false,
        portClosed: false,
        clusterRemoved: false,
        fixtureWorkdirsRemoved: true,
      },
    };
  }
  const wrapped = await withDisposablePostgres(run);
  return { ...wrapped.result, teardown: wrapped.teardown };
}

export function fixtureMentionsArchive(text: string): boolean {
  return ARCHIVE_MIGRATION_MARKERS.some((marker) => text.includes(marker));
}

export async function confirmPortClosed(port: number): Promise<boolean> {
  return !(await portIsOpen(port));
}
