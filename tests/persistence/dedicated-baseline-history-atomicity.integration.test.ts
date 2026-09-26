import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertLocalDbUrl,
  buildChildEnv,
  classifyCase,
  classifyFormalCase,
  confirmPortClosed,
  DisposablePostgresStartupError,
  FORMAL_BASELINE_FILE,
  FORMAL_BASELINE_NAME,
  FORMAL_BASELINE_PATH,
  FORMAL_BASELINE_SHA256,
  fixtureMentionsArchive,
  leftoverReport,
  LocalSupabaseCliError,
  postgresHarnessAvailable,
  readInstalledCliVersion,
  REQUIRED_CORE_TABLES,
  REQUIRED_FUNCTIONS,
  REQUIRED_INDEXES,
  REQUIRED_TRIGGERS,
  resolveLocalSupabaseCli,
  runAtomicitySpike,
  runFormalBaselineAtomicityMatrix,
  SPIKE_BASELINE_VERSION,
  SPIKE_CLI_VERSION,
  startDisposablePostgres,
  takeCliProcessAttempts,
  type CaseResult,
  type DisposablePostgres,
  type FormalCaseResult,
  type TeardownEvidence,
} from "./dedicated-baseline-history-atomicity-harness";

const LIVE =
  postgresHarnessAvailable() && process.env.RUN_DEDICATED_BASELINE_ATOMICITY_SPIKE === "1";

function executableSql(source: string): string {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"))
    .join("\n");
}

function caseOf(
  cases: CaseResult[],
  command: CaseResult["command"],
  shape: CaseResult["shape"],
  caseId: CaseResult["caseId"],
): CaseResult {
  const found = cases.find(
    (entry) => entry.command === command && entry.shape === shape && entry.caseId === caseId,
  );
  if (!found) {
    throw new Error(`missing spike case ${command} ${shape} ${caseId}`);
  }
  return found;
}

function formalCaseOf(
  cases: FormalCaseResult[],
  command: FormalCaseResult["command"],
  caseId: FormalCaseResult["caseId"],
): FormalCaseResult {
  const found = cases.find((entry) => entry.command === command && entry.caseId === caseId);
  if (!found) {
    throw new Error(`missing formal case ${command} ${caseId}`);
  }
  return found;
}

describe("Dedicated Baseline V0 history atomicity spike", () => {
  it("keeps the formal baseline free of authored transaction control", () => {
    const source = readFileSync(FORMAL_BASELINE_PATH, "utf8");
    const body = executableSql(source);
    expect(body.startsWith("create extension if not exists pgcrypto;")).toBe(true);
    expect(
      body.endsWith(
        "grant select, insert, update, delete on table public.student_lexeme_weaknesses to service_role;",
      ),
    ).toBe(true);
    expect(source).not.toMatch(/^begin;/m);
    expect(source).not.toMatch(/^commit;/m);
    expect(source).not.toMatch(/insert into\s+supabase_migrations/i);
    expect(createHash("sha256").update(readFileSync(FORMAL_BASELINE_PATH)).digest("hex")).toBe(
      FORMAL_BASELINE_SHA256,
    );
    for (const table of REQUIRED_CORE_TABLES) {
      expect(source).toContain(`create table ${table}`);
    }
    for (const fn of REQUIRED_FUNCTIONS) {
      expect(source).toContain(`function ${fn}()`);
    }
    for (const trigger of REQUIRED_TRIGGERS) {
      expect(source).toContain(`create trigger ${trigger}`);
    }
    for (const index of REQUIRED_INDEXES) {
      expect(source).toContain(index);
    }
  });

  it("refuses redirected or unknown-parameter local URLs", () => {
    expect(() => assertLocalDbUrl("postgresql://spike@example.com:5432/spike")).toThrow(
      /refusing non-local DB URL/,
    );
    expect(() => assertLocalDbUrl("postgresql://spike@10.0.0.1:5432/spike")).toThrow(
      /refusing non-local DB URL/,
    );
    expect(() =>
      assertLocalDbUrl("postgresql://spike@127.0.0.1:6543/spike?sslmode=disable&host=example.com"),
    ).toThrow(/refusing non-local DB URL/);
    expect(() =>
      assertLocalDbUrl("postgresql://spike@127.0.0.1:6543/spike?sslmode=disable&hostaddr=10.0.0.1"),
    ).toThrow(/refusing non-local DB URL/);
    expect(() =>
      assertLocalDbUrl("postgresql://spike@127.0.0.1:6543/spike?sslmode=disable&service=remote"),
    ).toThrow(/refusing non-local DB URL/);
    expect(() =>
      assertLocalDbUrl("postgresql://spike@127.0.0.1:6543/spike?sslmode=disable&foo=bar"),
    ).toThrow(/refusing non-local DB URL/);
    expect(() => assertLocalDbUrl("postgresql://spike@127.0.0.1/spike?sslmode=disable")).toThrow(
      /refusing non-local DB URL/,
    );
    expect(() =>
      assertLocalDbUrl("postgresql://spike@127.0.0.1:6543/spike?sslmode=disable", 9999),
    ).toThrow(/refusing non-local DB URL/);
    expect(() =>
      assertLocalDbUrl("postgresql://spike@127.0.0.1:6543/spike?sslmode=disable", 6543),
    ).not.toThrow();
    expect(() =>
      assertLocalDbUrl("postgresql://spike@localhost:6543/spike?sslmode=disable", 6543),
    ).not.toThrow();
  });

  it("does not copy remote database sentinels into the child environment", () => {
    const keys = ["SUPABASE_ACCESS_TOKEN", "PGHOST", "PGSERVICE"] as const;
    const previous: Partial<Record<(typeof keys)[number], string | undefined>> = {};
    for (const key of keys) {
      previous[key] = process.env[key];
      process.env[key] = "1";
    }
    try {
      const env = buildChildEnv({ SPIKE_MARKER: "1" });
      for (const key of keys) {
        expect(Object.hasOwn(env, key)).toBe(false);
      }
      expect(env.SPIKE_MARKER).toBe("1");
      expect(env.npm_config_yes).toBeUndefined();
      expect(env.PATH).toBeTypeOf("string");
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });

  it("uses the repo-local Supabase CLI 2.118.0", () => {
    const cli = resolveLocalSupabaseCli();
    const nodeModulesRoot = path.resolve(process.cwd(), "node_modules");
    expect(cli.requestedPath).toBe(path.join(nodeModulesRoot, ".bin", "supabase"));
    expect(cli.realPath.startsWith(`${nodeModulesRoot}${path.sep}`)).toBe(true);
    expect(cli.version).toBe(SPIKE_CLI_VERSION);
    expect(readInstalledCliVersion()).toBe(SPIKE_CLI_VERSION);
  });

  it("does not install or fall back when the local CLI binary is missing", () => {
    const missing = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      `supabase-missing-${createHash("sha256").update("atomicity-cli").digest("hex").slice(0, 12)}`,
    );
    expect(existsSync(missing)).toBe(false);
    takeCliProcessAttempts();
    expect(() => resolveLocalSupabaseCli({ binaryPath: missing })).toThrow(LocalSupabaseCliError);
    expect(() => resolveLocalSupabaseCli({ binaryPath: missing })).toThrow(
      /LOCAL_SUPABASE_CLI_MISSING/,
    );
    const attempts = takeCliProcessAttempts();
    expect(attempts).toEqual([]);
    expect(attempts.some((attempt) => /npx|npm/.test(attempt.command))).toBe(false);
    expect(attempts.some((attempt) => attempt.args.includes("supabase"))).toBe(false);
  });
});

describe.skipIf(!LIVE)("local PostgreSQL CLI apply matrix", () => {
  let postgres: DisposablePostgres;
  let teardown: TeardownEvidence | undefined;

  beforeAll(async () => {
    postgres = await startDisposablePostgres();
  }, 60_000);

  afterAll(async () => {
    if (postgres) {
      teardown = await postgres.teardown(true);
      if (!teardown.clusterStopped || !teardown.portClosed || !teardown.clusterRemoved) {
        throw new Error("disposable postgres teardown incomplete");
      }
    }
  }, 60_000);

  it(
    "records schema/history states for authored and no-authored fixtures",
    async () => {
      const summary = await runAtomicitySpike({
        commands: ["db-push", "migration-up"],
        postgres,
      });

      expect(summary.cliVersion).toBe(SPIKE_CLI_VERSION);
      expect(summary.host).toBe("127.0.0.1");
      expect(summary.cases).toHaveLength(12);
      expect(summary.teardown.fixtureWorkdirsRemoved).toBe(true);

      for (const result of summary.cases) {
        expect(result.after.listenAddresses).toBe("127.0.0.1");
        expect(
          result.after.serverAddr === "127.0.0.1" || result.after.serverAddr === "127.0.0.1/32",
        ).toBe(true);
      }

      for (const command of ["db-push", "migration-up"] as const) {
        for (const shape of ["authored-begin-commit", "no-authored-transaction"] as const) {
          const success = caseOf(summary.cases, command, shape, "A-success");
          const schemaFail = caseOf(summary.cases, command, shape, "B-schema-fail");
          const historyFail = caseOf(summary.cases, command, shape, "C-history-fail");
          const successClass = classifyCase(success);
          const schemaFailClass = classifyCase(schemaFail);
          const historyFailClass = classifyCase(historyFail);

          expect(success.cliFailed).toBe(false);
          expect(successClass.schemaState).toBe("COMPLETE");
          expect(successClass.applyState).toBe("COMPLETE");
          expect(successClass.exactlyOneHistoryRow).toBe(true);
          expect(success.after.historyRows[0]?.version).toBe(success.version);
          expect(success.after.historyRows[0]?.name).toBe("spike_success");

          expect(schemaFail.cliFailed).toBe(true);
          expect(schemaFailClass.schemaState).toBe("ABSENT");
          expect(schemaFailClass.applyState).toBe("ABSENT");
          expect(schemaFailClass.historyPresent).toBe(false);

          expect(historyFail.cliFailed).toBe(true);
          expect(historyFail.cliTail).toContain("SPIKE_HISTORY_INSERT_REJECTED");
          expect(historyFailClass.historyPresent).toBe(false);
          if (shape === "authored-begin-commit") {
            expect(historyFailClass.schemaState).toBe("COMPLETE");
            expect(historyFailClass.applyState).toBe("PARTIAL");
          } else {
            expect(historyFailClass.schemaState).toBe("ABSENT");
            expect(historyFailClass.applyState).toBe("ABSENT");
          }
        }
      }
    },
    180_000,
  );

  it(
    "applies the exact formal baseline A/B/C on db push and migration up",
    async () => {
      const summary = await runFormalBaselineAtomicityMatrix({
        commands: ["db-push", "migration-up"],
        postgres,
      });

      expect(summary.cliVersion).toBe(SPIKE_CLI_VERSION);
      expect(summary.host).toBe("127.0.0.1");
      expect(summary.cases).toHaveLength(6);
      expect(summary.teardown.fixtureWorkdirsRemoved).toBe(true);

      for (const result of summary.cases) {
        expect(result.listedMigrationFiles).toEqual([FORMAL_BASELINE_FILE]);
        expect(result.listedMigrationFiles.some((name) => fixtureMentionsArchive(name))).toBe(false);
        expect(result.after.listenAddresses).toBe("127.0.0.1");
        expect(
          result.after.serverAddr === "127.0.0.1" || result.after.serverAddr === "127.0.0.1/32",
        ).toBe(true);
        expect(result.after.historyRows.some((row) => fixtureMentionsArchive(row.version))).toBe(
          false,
        );
        if (result.after.schemaState === "PARTIAL") {
          throw new Error(`PARTIAL leftover ${leftoverReport(result)}`);
        }
        if (result.command === "db-push") {
          expect(result.dryRunTail).toContain(FORMAL_BASELINE_FILE);
          expect(fixtureMentionsArchive(result.dryRunTail)).toBe(false);
        }
      }

      for (const command of ["db-push", "migration-up"] as const) {
        const success = formalCaseOf(summary.cases, command, "A-success");
        const schemaFail = formalCaseOf(summary.cases, command, "B-schema-fail");
        const historyFail = formalCaseOf(summary.cases, command, "C-history-fail");
        const successClass = classifyFormalCase(success);
        const schemaFailClass = classifyFormalCase(schemaFail);
        const historyFailClass = classifyFormalCase(historyFail);

        expect(success.cliFailed, leftoverReport(success)).toBe(false);
        expect(successClass.schemaState).toBe("COMPLETE");
        expect(successClass.applyState).toBe("COMPLETE");
        expect(success.after.presentTables).toEqual([...REQUIRED_CORE_TABLES].sort());
        expect(success.after.missingTables).toEqual([]);
        expect(success.after.presentFunctions).toEqual([...REQUIRED_FUNCTIONS]);
        expect(success.after.presentTriggers).toEqual([...REQUIRED_TRIGGERS]);
        expect(success.after.presentIndexes).toEqual([...REQUIRED_INDEXES].sort());
        expect(success.after.extensionPresent).toBe(true);
        expect(successClass.exactlyOneHistoryRow).toBe(true);
        expect(success.after.historyRows[0]?.version).toBe(SPIKE_BASELINE_VERSION);
        expect(success.after.historyRows[0]?.name).toBe(FORMAL_BASELINE_NAME);

        expect(schemaFail.cliFailed, leftoverReport(schemaFail)).toBe(true);
        expect(schemaFailClass.schemaState).toBe("ABSENT");
        expect(schemaFailClass.applyState).toBe("ABSENT");
        expect(schemaFail.after.presentTables).toEqual([]);
        expect(schemaFail.after.extensionPresent).toBe(false);
        expect(schemaFailClass.historyPresent).toBe(false);

        expect(historyFail.cliFailed, leftoverReport(historyFail)).toBe(true);
        expect(historyFail.cliTail).toContain("SPIKE_HISTORY_INSERT_REJECTED");
        expect(historyFailClass.schemaState).toBe("ABSENT");
        expect(historyFailClass.applyState).toBe("ABSENT");
        expect(historyFail.after.presentTables).toEqual([]);
        expect(historyFail.after.extensionPresent).toBe(false);
        expect(historyFailClass.historyPresent).toBe(false);
      }
    },
    240_000,
  );

  it("stops the shared disposable cluster", async () => {
    const evidence = await postgres.teardown(true);
    expect(evidence.clusterStopped).toBe(true);
    expect(evidence.portClosed).toBe(true);
    expect(evidence.clusterRemoved).toBe(true);
    expect(evidence.fixtureWorkdirsRemoved).toBe(true);
    teardown = evidence;
  });
});

describe.skipIf(!LIVE)("disposable postgres startup failure cleanup", () => {
  async function expectStartupCleanup(failAfterStart: "version-probe" | "before-return") {
    try {
      await startDisposablePostgres({ failAfterStart });
      throw new Error(`expected ${failAfterStart} startup failure`);
    } catch (error) {
      expect(error).toBeInstanceOf(DisposablePostgresStartupError);
      const startupError = error as DisposablePostgresStartupError;
      expect(startupError.cleanupError).toBeNull();
      expect(startupError.cleanup).not.toBeNull();
      expect(startupError.cleanup?.clusterStopped).toBe(true);
      expect(startupError.cleanup?.portClosed).toBe(true);
      expect(startupError.cleanup?.clusterRemoved).toBe(true);
      expect(startupError.clusterDir === null || !existsSync(startupError.clusterDir)).toBe(true);
      if (startupError.port !== null) {
        expect(await confirmPortClosed(startupError.port)).toBe(true);
      }
      return startupError;
    }
  }

  it(
    "stops process, closes port, and removes the directory after a version probe failure",
    async () => {
      const error = await expectStartupCleanup("version-probe");
      expect(error.message).toContain("SPIKE_VERSION_PROBE_FAIL");
      expect(error.message).not.toContain("; cleanup:");
    },
    60_000,
  );

  it(
    "stops process, closes port, and removes the directory after a handle-return failure",
    async () => {
      const error = await expectStartupCleanup("before-return");
      expect(error.message).toContain("SPIKE_HANDLE_INIT_FAIL");
      expect(error.message).not.toContain("; cleanup:");
    },
    60_000,
  );
});
