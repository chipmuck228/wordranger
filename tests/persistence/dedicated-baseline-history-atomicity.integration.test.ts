import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertLocalDbUrl,
  classifyCase,
  classifyFormalCase,
  FORMAL_BASELINE_FILE,
  FORMAL_BASELINE_NAME,
  FORMAL_BASELINE_PATH,
  FORMAL_BASELINE_SHA256,
  fixtureMentionsArchive,
  postgresHarnessAvailable,
  readInstalledCliVersion,
  runAtomicitySpike,
  runFormalBaselineAtomicityMatrix,
  SPIKE_BASELINE_VERSION,
  SPIKE_CLI_VERSION,
  type CaseResult,
  type FormalCaseResult,
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
    expect(body).not.toMatch(/^begin;/m);
    expect(body).not.toMatch(/^commit;/m);
    expect(source).not.toMatch(/^begin;/m);
    expect(source).not.toMatch(/^commit;/m);
    expect(source).not.toMatch(/insert into\s+supabase_migrations/i);
    expect(createHash("sha256").update(readFileSync(FORMAL_BASELINE_PATH)).digest("hex")).toBe(
      FORMAL_BASELINE_SHA256,
    );
    expect(FORMAL_BASELINE_PATH).toContain(SPIKE_BASELINE_VERSION);
  });

  it("refuses non-local database URLs and accepts loopback only", () => {
    expect(() => assertLocalDbUrl("postgresql://spike@example.com:5432/spike")).toThrow(
      /refusing non-local DB URL/,
    );
    expect(() => assertLocalDbUrl("postgresql://spike@10.0.0.1:5432/spike")).toThrow(
      /refusing non-local DB URL/,
    );
    expect(() =>
      assertLocalDbUrl("postgresql://spike@127.0.0.1:6543/spike?sslmode=disable"),
    ).not.toThrow();
    expect(() =>
      assertLocalDbUrl("postgresql://spike@localhost:6543/spike?sslmode=disable"),
    ).not.toThrow();
  });

  it("uses the installed Supabase CLI 2.118.0", () => {
    expect(readInstalledCliVersion()).toBe(SPIKE_CLI_VERSION);
  });
});

describe.skipIf(!LIVE)("local PostgreSQL CLI apply matrix", () => {
  it(
    "records schema/history states for authored and no-authored fixtures",
    async () => {
      const summary = await runAtomicitySpike({
        commands: ["db-push", "migration-up"],
      });

      expect(summary.cliVersion).toBe(SPIKE_CLI_VERSION);
      expect(summary.host).toBe("127.0.0.1");
      expect(summary.cases).toHaveLength(12);

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
          expect(successClass.schemaPresent).toBe(true);
          expect(successClass.exactlyOneHistoryRow).toBe(true);
          expect(success.after.historyRows[0]?.version).toBe(success.version);
          expect(success.after.historyRows[0]?.name).toBe("spike_success");
          expect(success.after.historyRows[0]?.statements.length).toBeGreaterThan(0);
          if (shape === "authored-begin-commit") {
            expect(success.after.historyRows[0]?.statements.some((sql) => /^begin\b/i.test(sql))).toBe(
              true,
            );
            expect(success.after.historyRows[0]?.statements.some((sql) => /^commit\b/i.test(sql))).toBe(
              true,
            );
          } else {
            expect(success.after.historyRows[0]?.statements.some((sql) => /^begin\b/i.test(sql))).toBe(
              false,
            );
            expect(success.after.historyRows[0]?.statements.some((sql) => /^commit\b/i.test(sql))).toBe(
              false,
            );
          }

          expect(schemaFail.cliFailed).toBe(true);
          expect(schemaFailClass.schemaPresent).toBe(false);
          expect(schemaFailClass.historyPresent).toBe(false);
          expect(schemaFailClass.halfState).toBe(false);

          expect(historyFail.cliFailed).toBe(true);
          expect(historyFailClass.historyPresent).toBe(false);
          expect(historyFail.cliTail).toContain("SPIKE_HISTORY_INSERT_REJECTED");
          if (shape === "authored-begin-commit") {
            expect(historyFailClass.schemaPresent).toBe(true);
            expect(historyFailClass.halfState).toBe(true);
          } else {
            expect(historyFailClass.schemaPresent).toBe(false);
            expect(historyFailClass.halfState).toBe(false);
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
      });

      expect(summary.cliVersion).toBe(SPIKE_CLI_VERSION);
      expect(summary.host).toBe("127.0.0.1");
      expect(summary.cases).toHaveLength(6);

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

        expect(success.cliFailed).toBe(false);
        expect(successClass.schemaPresent).toBe(true);
        expect(successClass.exactlyOneHistoryRow).toBe(true);
        expect(success.after.historyRows[0]?.version).toBe(SPIKE_BASELINE_VERSION);
        expect(success.after.historyRows[0]?.name).toBe(FORMAL_BASELINE_NAME);
        expect(
          success.after.historyRows[0]?.statements.some((sql) => /^begin\b/i.test(sql)),
        ).toBe(false);
        expect(
          success.after.historyRows[0]?.statements.some((sql) => /^commit\b/i.test(sql)),
        ).toBe(false);
        expect(success.after.historyRows[0]?.statements[0]).toMatch(
          /create extension if not exists pgcrypto/i,
        );

        expect(schemaFail.cliFailed).toBe(true);
        expect(schemaFailClass.schemaPresent).toBe(false);
        expect(schemaFailClass.historyPresent).toBe(false);
        expect(schemaFailClass.halfState).toBe(false);

        expect(historyFail.cliFailed).toBe(true);
        expect(historyFail.cliTail).toContain("SPIKE_HISTORY_INSERT_REJECTED");
        expect(historyFailClass.schemaPresent).toBe(false);
        expect(historyFailClass.historyPresent).toBe(false);
        expect(historyFailClass.halfState).toBe(false);

        process.stdout.write(
          [
            `formal ${command} A: schema=${successClass.schemaPresent} history=${successClass.historyPresent} version=${success.after.historyRows[0]?.version} name=${success.after.historyRows[0]?.name} statements=${success.after.historyRows[0]?.statements.length}`,
            `formal ${command} B: schema=${schemaFailClass.schemaPresent} history=${schemaFailClass.historyPresent} half=${schemaFailClass.halfState}`,
            `formal ${command} C: schema=${historyFailClass.schemaPresent} history=${historyFailClass.historyPresent} half=${historyFailClass.halfState}`,
            "",
          ].join("\n"),
        );
      }
    },
    240_000,
  );
});
