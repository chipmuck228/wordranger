import { spawnSync } from "node:child_process";
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
import { createServer } from "node:net";
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

const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const ARCHIVE_MIGRATION_MARKERS = [
  "202609250001",
  "migrations_archive",
  "pre_dedicated_baseline",
];

export type ApplyCommand = "db-push" | "migration-up";
export type TransactionShape = "authored-begin-commit" | "no-authored-transaction";
export type CaseId = "A-success" | "B-schema-fail" | "C-history-fail";

export interface HistoryRow {
  version: string;
  name: string;
  statements: string[];
}

export interface SchemaHistoryState {
  listenAddresses: string;
  serverAddr: string;
  probeTableExists: boolean;
  historyTableExists: boolean;
  historyRows: HistoryRow[];
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
  clusterDir: string;
  databases: string[];
  cases: CaseResult[];
}

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

export function readInstalledCliVersion(): string {
  const result = spawnSync("npx", ["supabase", "--version"], {
    encoding: "utf8",
    env: childEnv({ npm_config_yes: "true" }),
  });
  return (result.stdout || result.stderr).trim();
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

function childEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const key of Object.keys(env)) {
    if (
      /^(DATABASE_URL|DIRECT_URL|POSTGRES_|SUPABASE_DB|SUPABASE_URL|NEXT_PUBLIC_SUPABASE)/i.test(
        key,
      )
    ) {
      delete env[key];
    }
  }
  return env;
}

function requireBin(name: string): string {
  const bin = findPostgresBin(name);
  if (!bin) throw new Error(`missing local PostgreSQL binary: ${name}`);
  return bin;
}

function execPg(
  binName: string,
  args: string[],
  extraEnv: Record<string, string | undefined> = {},
): string {
  const result = spawnSync(requireBin(binName), args, {
    encoding: "utf8",
    env: childEnv(extraEnv),
  });
  if (result.status !== 0) {
    throw new Error(
      `${binName} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return (result.stdout || "").trim();
}

export function assertLocalDbUrl(dbUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error("refusing non-local DB URL");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("refusing non-local DB URL");
  }
  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_DB_HOSTS.has(host)) {
    throw new Error("refusing non-local DB URL");
  }
  if (host.includes("supabase") || parsed.href.toLowerCase().includes("supabase.co")) {
    throw new Error("refusing non-local DB URL");
  }
  return dbUrl;
}

function localDbUrl(port: number, database: string): string {
  return assertLocalDbUrl(`postgresql://spike@127.0.0.1:${port}/${database}?sslmode=disable`);
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
    "-F",
    "|",
    "-c",
    sql,
  ]);
}

function observe(port: number, database: string): SchemaHistoryState {
  const listenAddresses = psql(port, database, "show listen_addresses;");
  const serverAddr = psql(port, database, "select coalesce(inet_server_addr()::text, '');");
  const probeTableExists =
    psql(port, database, `select to_regclass('${SPIKE_PROBE_TABLE}') is not null;`) === "t";
  const historyTableExists =
    psql(port, database, `select to_regclass('${HISTORY_TABLE}') is not null;`) === "t";
  let historyRows: HistoryRow[] = [];
  if (historyTableExists) {
    const raw = psql(
      port,
      database,
      "select coalesce(json_agg(json_build_object('version', version, 'name', coalesce(name, ''), 'statements', statements) order by version)::text, '[]') from supabase_migrations.schema_migrations;",
    );
    const parsed = JSON.parse(raw.length > 0 ? raw : "[]") as Array<{
      version?: unknown;
      name?: unknown;
      statements?: unknown;
    }>;
    historyRows = parsed.map((row) => ({
      version: String(row.version ?? ""),
      name: String(row.name ?? ""),
      statements: Array.isArray(row.statements) ? row.statements.map((entry) => String(entry)) : [],
    }));
  }
  return { listenAddresses, serverAddr, probeTableExists, historyTableExists, historyRows };
}

function writeFixture(
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

function applyCli(
  command: ApplyCommand,
  workdir: string,
  dbUrl: string,
  extra: string[] = [],
): { exitCode: number; tail: string } {
  assertLocalDbUrl(dbUrl);
  const args =
    command === "db-push"
      ? [
          "db",
          "push",
          "--db-url",
          dbUrl,
          "--yes",
          "--skip-vault",
          "--workdir",
          workdir,
          ...extra,
        ]
      : ["migration", "up", "--db-url", dbUrl, "--yes", "--workdir", workdir, ...extra];
  const result = spawnSync("npx", ["supabase", ...args], {
    encoding: "utf8",
    cwd: workdir,
    env: childEnv({ npm_config_yes: "true" }),
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  const lines = combined.split(/\r?\n/u);
  return {
    exitCode: result.status ?? 1,
    tail: lines.slice(-24).join("\n"),
  };
}

export async function withDisposablePostgres<T>(
  run: (ctx: {
    host: string;
    port: number;
    clusterDir: string;
    postgresVersion: string;
    createDatabase: () => string;
  }) => Promise<T>,
): Promise<T> {
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
  const extra = [
    "listen_addresses = '127.0.0.1'",
    `port = ${port}`,
    `unix_socket_directories = '${clusterDir}'`,
    "fsync = off",
    "synchronous_commit = off",
    "full_page_writes = off",
    "",
  ].join("\n");
  const existing = readFileSync(confPath, "utf8");
  writeFileSync(confPath, `${existing}\n${extra}`);
  execPg("pg_ctl", ["-D", clusterDir, "-l", path.join(clusterDir, "pg.log"), "-w", "start"]);
  try {
    const postgresVersion = psql(port, "template1", "show server_version;");
    return await run({
      host: "127.0.0.1",
      port,
      clusterDir,
      postgresVersion,
      createDatabase: () => {
        const database = `spike_${randomToken()}`;
        execPg("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "spike", database]);
        return database;
      },
    });
  } finally {
    spawnSync(requireBin("pg_ctl"), ["-D", clusterDir, "-m", "fast", "-w", "stop"], {
      encoding: "utf8",
      env: childEnv(),
    });
    rmSync(clusterDir, { recursive: true, force: true });
  }
}

export async function runAtomicitySpike(options?: {
  commands?: ApplyCommand[];
}): Promise<SpikeRunSummary> {
  const commands = options?.commands ?? ["db-push", "migration-up"];
  const cliVersion = readInstalledCliVersion();
  const cases: CaseResult[] = [];
  const databases: string[] = [];

  return withDisposablePostgres(async ({ host, port, clusterDir, postgresVersion, createDatabase }) => {
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
    for (const command of commands) {
      for (const shape of shapes) {
        for (const spec of matrix) {
          serial += 1;
          const database = createDatabase();
          databases.push(database);
          const version = `${spec.versionPrefix}${String(serial).padStart(2, "0")}`;
          const workdir = mkdtempSync(path.join(tmpdir(), "wr-spike-fixture-"));
          try {
            writeFixture(workdir, version, spec.name, shape, spec.body);
            if (spec.injectHistoryFailure) {
              psql(port, database, HISTORY_FAIL_SETUP);
            }
            const applied = applyCli(command, workdir, localDbUrl(port, database));
            cases.push({
              caseId: spec.caseId,
              shape,
              command,
              database,
              version,
              cliExitCode: applied.exitCode,
              cliFailed: applied.exitCode !== 0,
              cliTail: applied.tail,
              after: observe(port, database),
            });
          } finally {
            rmSync(workdir, { recursive: true, force: true });
          }
        }
      }
    }

    return {
      cliVersion,
      postgresVersion,
      host,
      port,
      clusterDir,
      databases,
      cases,
    };
  });
}

export function classifyCase(result: CaseResult): {
  schemaPresent: boolean;
  historyPresent: boolean;
  halfState: boolean;
  exactlyOneHistoryRow: boolean;
} {
  const schemaPresent = result.after.probeTableExists;
  const historyPresent = result.after.historyRows.some((row) => row.version === result.version);
  return {
    schemaPresent,
    historyPresent,
    halfState: schemaPresent !== historyPresent,
    exactlyOneHistoryRow: result.after.historyRows.length === 1 && historyPresent,
  };
}

export interface FormalCaseResult {
  caseId: CaseId;
  command: ApplyCommand;
  cliExitCode: number;
  cliFailed: boolean;
  cliTail: string;
  dryRunTail: string;
  listedMigrationFiles: string[];
  after: {
    listenAddresses: string;
    serverAddr: string;
    requiredCorePresent: boolean;
    historyTableExists: boolean;
    historyRows: HistoryRow[];
  };
}

export interface FormalSpikeSummary {
  cliVersion: string;
  postgresVersion: string;
  host: string;
  port: number;
  cases: FormalCaseResult[];
}

const FORMAL_CORE_TABLES = [
  "public.vocabulary_source_entries",
  "public.lexemes",
  "public.student_lexeme_weaknesses",
] as const;

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
  writeFileSync(
    path.join(migrationsDir, FORMAL_BASELINE_FILE),
    mutate ? mutate(source) : source,
  );
  if (existsSync(path.join(root, "supabase", "migrations_archive"))) {
    throw new Error("formal fixture must not contain migrations_archive");
  }
  return readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
}

function observeFormal(port: number, database: string): FormalCaseResult["after"] {
  const base = observe(port, database);
  const requiredCorePresent = FORMAL_CORE_TABLES.every(
    (table) => psql(port, database, `select to_regclass('${table}') is not null;`) === "t",
  );
  return {
    listenAddresses: base.listenAddresses,
    serverAddr: base.serverAddr,
    requiredCorePresent,
    historyTableExists: base.historyTableExists,
    historyRows: base.historyRows,
  };
}

export function classifyFormalCase(result: FormalCaseResult): {
  schemaPresent: boolean;
  historyPresent: boolean;
  halfState: boolean;
  exactlyOneHistoryRow: boolean;
} {
  const schemaPresent = result.after.requiredCorePresent;
  const historyPresent = result.after.historyRows.some(
    (row) => row.version === SPIKE_BASELINE_VERSION,
  );
  return {
    schemaPresent,
    historyPresent,
    halfState: schemaPresent !== historyPresent,
    exactlyOneHistoryRow: result.after.historyRows.length === 1 && historyPresent,
  };
}

export async function runFormalBaselineAtomicityMatrix(options?: {
  commands?: ApplyCommand[];
}): Promise<FormalSpikeSummary> {
  const commands = options?.commands ?? ["db-push", "migration-up"];
  const cliVersion = readInstalledCliVersion();
  const cases: FormalCaseResult[] = [];

  return withDisposablePostgres(async ({ host, port, postgresVersion, createDatabase }) => {
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

    for (const command of commands) {
      for (const spec of specs) {
        const database = createDatabase();
        const workdir = mkdtempSync(path.join(tmpdir(), "wr-formal-baseline-"));
        try {
          const listedMigrationFiles = writeFormalFixture(workdir, spec.mutate);
          psql(port, database, FORMAL_ROLE_SETUP);
          if (spec.injectHistoryFailure) {
            psql(port, database, HISTORY_FAIL_SETUP);
          }
          const dbUrl = localDbUrl(port, database);
          const dryRun =
            command === "db-push"
              ? applyCli(command, workdir, dbUrl, ["--dry-run"])
              : { exitCode: 0, tail: "" };
          const applied = applyCli(command, workdir, dbUrl);
          cases.push({
            caseId: spec.caseId,
            command,
            cliExitCode: applied.exitCode,
            cliFailed: applied.exitCode !== 0,
            cliTail: applied.tail,
            dryRunTail: dryRun.tail,
            listedMigrationFiles,
            after: observeFormal(port, database),
          });
        } finally {
          rmSync(workdir, { recursive: true, force: true });
        }
      }
    }

    return {
      cliVersion,
      postgresVersion,
      host,
      port,
      cases,
    };
  });
}

export function fixtureMentionsArchive(text: string): boolean {
  return ARCHIVE_MIGRATION_MARKERS.some((marker) => text.includes(marker));
}

