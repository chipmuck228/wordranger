import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY_TARGET_SEED_RELATIVE_PATH,
  EXPECTED_LEXEME_COUNT,
  EXPECTED_RELATION_COUNT,
  EXPECTED_SOURCE_ENTRY_COUNT,
  EXPECTED_TAG_COUNT,
  EXPECTED_VOCABULARY_CONTENT_FINGERPRINT,
  LEARNER_ZERO_TABLES,
  OBSERVED_VOCABULARY_JSON_SQL,
  VOCABULARY_SEED_TABLES,
  generateDedicatedVocabularySeedSql,
  loadEffectiveVocabularySeedRows,
  observedVocabularyImportRowsFromDatabase,
  runDedicatedVocabularySeedCli,
} from "@/server/vocabulary/import/empty-target-vocabulary-seed";
import { fingerprintVocabularyImportRows } from "@/server/vocabulary/import/rebuild-contract";
import {
  EMPTY_TARGET_SEED_LIVE_FLAG,
  isEmptyTargetSeedLive,
  requireLocalPostgresql16,
} from "./dedicated-vocabulary-empty-target-seed-live-gate";
import {
  buildChildEnv,
  findPostgresBin,
  postgresHarnessAvailable,
  withDisposablePostgres,
} from "./dedicated-baseline-history-atomicity-harness";

const LIVE = isEmptyTargetSeedLive();
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";

function isolatedChildEnv(): NodeJS.ProcessEnv {
  const env = buildChildEnv();
  const leaked = Object.keys(env).filter((key) =>
    /^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|POSTGRES_|VERCEL_|DATABASE_URL|DIRECT_URL|PG)/.test(
      key,
    ),
  );
  expect(leaked).toEqual([]);
  return env;
}

function requirePsql(): string {
  const bin = findPostgresBin("psql");
  requireLocalPostgresql16(bin !== null);
  return bin!;
}

function runPsql(
  port: number,
  database: string,
  extra: string[],
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(requirePsql(), extra, {
    encoding: "utf8",
    env: isolatedChildEnv(),
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function psql(port: number, database: string, sql: string): string {
  const result = runPsql(port, database, [
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
  if (result.status !== 0) {
    const detail = (result.stderr || "PSQL_FAILED").replace(/\s+/g, " ").slice(0, 240);
    throw new Error(detail);
  }
  return result.stdout.trim();
}

function applySqlFile(
  port: number,
  database: string,
  file: string,
): { status: number; output: string } {
  const result = runPsql(port, database, [
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
    "-f",
    file,
  ]);
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
  };
}

function applyBaseline(port: number, database: string): void {
  const bootstrap = runPsql(port, database, [
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
    "-c",
    `
      do $$
      begin
        if not exists (select from pg_roles where rolname = 'anon') then
          create role anon nologin nosuperuser noinherit;
        end if;
        if not exists (select from pg_roles where rolname = 'authenticated') then
          create role authenticated nologin nosuperuser noinherit;
        end if;
        if not exists (select from pg_roles where rolname = 'service_role') then
          create role service_role nologin nosuperuser noinherit bypassrls;
        end if;
      end
      $$;
      alter role service_role with bypassrls;
      grant service_role to spike;
    `,
  ]);
  if (bootstrap.status !== 0) {
    throw new Error("BASELINE_ROLE_FAILED");
  }
  const work = mkdtempSync(path.join(tmpdir(), "wr-empty-seed-"));
  const baselineFile = path.join(work, "baseline.sql");
  writeFileSync(baselineFile, readFileSync(path.join(process.cwd(), BASELINE)));
  const apply = applySqlFile(port, database, baselineFile);
  const history = runPsql(port, database, [
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
    "-c",
    `
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        name text
      );
      insert into supabase_migrations.schema_migrations (version, name)
      values ('202609260001', 'dedicated_wordranger_baseline_v0');
      grant usage on schema supabase_migrations to service_role;
      grant select on supabase_migrations.schema_migrations to service_role;
    `,
  ]);
  rmSync(work, { recursive: true, force: true });
  if (apply.status !== 0 || history.status !== 0) {
    throw new Error("BASELINE_APPLY_FAILED");
  }
}

function countSql(tables: readonly string[]): string {
  return tables
    .map((table) => `(select count(*)::int from public.${table})`)
    .join(" || ',' || ");
}

function readCounts(
  port: number,
  database: string,
): { vocabulary: number[]; learner: number[] } {
  return {
    vocabulary: psql(port, database, `select ${countSql(VOCABULARY_SEED_TABLES)};`)
      .split(",")
      .map((value) => Number(value)),
    learner: psql(port, database, `select ${countSql(LEARNER_ZERO_TABLES)};`)
      .split(",")
      .map((value) => Number(value)),
  };
}

function readFingerprint(port: number, database: string): string {
  const work = mkdtempSync(path.join(tmpdir(), "wr-empty-seed-fp-"));
  const file = path.join(work, "observed.json");
  try {
    const result = runPsql(port, database, [
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
      "-o",
      file,
      "-c",
      OBSERVED_VOCABULARY_JSON_SQL,
    ]);
    if (result.status !== 0) {
      throw new Error("OBSERVED_ROWS_QUERY_FAILED");
    }
    const parsed = JSON.parse(readFileSync(file, "utf8")) as {
      sourceEntries: Record<string, unknown>[];
      lexemes: Record<string, unknown>[];
      relations: Record<string, unknown>[];
      tags: Record<string, unknown>[];
    };
    return fingerprintVocabularyImportRows(
      observedVocabularyImportRowsFromDatabase(parsed),
    ).fingerprint;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function writeTempSql(contents: string): { file: string; cleanup: () => void } {
  const work = mkdtempSync(path.join(tmpdir(), "wr-empty-seed-copy-"));
  const file = path.join(work, "seed.sql");
  writeFileSync(file, contents);
  return {
    file,
    cleanup: () => rmSync(work, { recursive: true, force: true }),
  };
}

describe.skipIf(!LIVE)("dedicated empty-target vocabulary seed local PostgreSQL 16", () => {
  it("proves A–H on disposable PostgreSQL 16", async () => {
    requireLocalPostgresql16(postgresHarnessAvailable());
    expect(EMPTY_TARGET_SEED_LIVE_FLAG).toBe(
      "RUN_DEDICATED_VOCABULARY_EMPTY_TARGET_SEED",
    );
    const committedSeed = readFileSync(
      path.join(process.cwd(), EMPTY_TARGET_SEED_RELATIVE_PATH),
      "utf8",
    );
    const first = generateDedicatedVocabularySeedSql();
    const second = generateDedicatedVocabularySeedSql();
    expect(first.sql).toBe(committedSeed);
    expect(second.sql).toBe(first.sql);
    expect(first.seedSha256).toBe(second.seedSha256);
    const checked = runDedicatedVocabularySeedCli(["--check"], {
      log: () => undefined,
      error: () => undefined,
    });
    expect(checked.exitCode).toBe(0);
    expect(checked.code).toBe("DEDICATED_VOCABULARY_SEED_CHECK_OK");

    const { result, teardown } = await withDisposablePostgres(async (ctx) => {
      const seedPath = path.join(process.cwd(), EMPTY_TARGET_SEED_RELATIVE_PATH);
      const successDb = ctx.createDatabase();
      applyBaseline(ctx.port, successDb);
      const empty = readCounts(ctx.port, successDb);
      expect(empty.vocabulary).toEqual([0, 0, 0, 0]);
      expect(empty.learner).toEqual([0, 0, 0, 0, 0, 0]);

      const applied = applySqlFile(ctx.port, successDb, seedPath);
      expect(applied.status).toBe(0);

      const afterA = readCounts(ctx.port, successDb);
      expect(afterA.vocabulary).toEqual([
        EXPECTED_SOURCE_ENTRY_COUNT,
        EXPECTED_LEXEME_COUNT,
        EXPECTED_RELATION_COUNT,
        EXPECTED_TAG_COUNT,
      ]);
      expect(afterA.learner).toEqual([0, 0, 0, 0, 0, 0]);
      const fingerprint = readFingerprint(ctx.port, successDb);
      expect(fingerprint).toBe(EXPECTED_VOCABULARY_CONTENT_FINGERPRINT);
      expect(
        psql(
          ctx.port,
          successDb,
          "select count(*)::int from supabase_migrations.schema_migrations;",
        ),
      ).toBe("1");

      const repeat = applySqlFile(ctx.port, successDb, seedPath);
      expect(repeat.status).not.toBe(0);
      expect(repeat.output).toContain("EMPTY_TARGET_SEED_PRECONDITION_FAILED");
      const afterB = readCounts(ctx.port, successDb);
      expect(afterB).toEqual(afterA);
      expect(readFingerprint(ctx.port, successDb)).toBe(
        EXPECTED_VOCABULARY_CONTENT_FINGERPRINT,
      );

      const denied = psql(
        ctx.port,
        successDb,
        `select json_build_object(
            'select_ok', has_table_privilege('service_role', 'public.lexemes', 'SELECT'),
            'insert_ok', has_table_privilege('service_role', 'public.lexemes', 'INSERT'),
            'delete_ok', has_table_privilege('service_role', 'public.lexemes', 'DELETE'),
            'truncate_ok', has_table_privilege('service_role', 'public.lexemes', 'TRUNCATE')
          )::text;`,
      );
      const privileges = JSON.parse(denied) as {
        select_ok: boolean;
        insert_ok: boolean;
        delete_ok: boolean;
        truncate_ok: boolean;
      };
      expect(privileges.select_ok).toBe(true);
      expect(privileges.insert_ok).toBe(true);
      expect(privileges.delete_ok).toBe(false);
      expect(privileges.truncate_ok).toBe(false);
      const deleteAttempt = runPsql(ctx.port, successDb, [
        "-h",
        "127.0.0.1",
        "-p",
        String(ctx.port),
        "-U",
        "spike",
        "-d",
        successDb,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "set role service_role; delete from public.lexemes;",
      ]);
      expect(deleteAttempt.status).not.toBe(0);
      expect(`${deleteAttempt.stdout}\n${deleteAttempt.stderr}`).toMatch(
        /permission denied/i,
      );
      const truncateAttempt = runPsql(ctx.port, successDb, [
        "-h",
        "127.0.0.1",
        "-p",
        String(ctx.port),
        "-U",
        "spike",
        "-d",
        successDb,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "set role service_role; truncate public.lexemes;",
      ]);
      expect(truncateAttempt.status).not.toBe(0);
      expect(readCounts(ctx.port, successDb)).toEqual(afterA);

      const midFailDb = ctx.createDatabase();
      applyBaseline(ctx.port, midFailDb);
      const midFail = writeTempSql(
        committedSeed.replace("\ncommit;\n", "\nselect 1 / 0;\ncommit;\n"),
      );
      const midFailApply = applySqlFile(ctx.port, midFailDb, midFail.file);
      midFail.cleanup();
      expect(midFailApply.status).not.toBe(0);
      const afterC = readCounts(ctx.port, midFailDb);
      expect(afterC.vocabulary).toEqual([0, 0, 0, 0]);
      expect(afterC.learner).toEqual([0, 0, 0, 0, 0, 0]);

      const nonemptyVocabDb = ctx.createDatabase();
      applyBaseline(ctx.port, nonemptyVocabDb);
      psql(
        ctx.port,
        nonemptyVocabDb,
        `
          insert into public.vocabulary_source_entries (
            id, canonical_key, source_index, source_word_raw
          ) values (
            '00000000-0000-4000-8000-0000000000aa',
            'src-empty-target-seed-fixture',
            99999,
            'disposable'
          );
        `,
      );
      const nonemptyVocabApply = applySqlFile(ctx.port, nonemptyVocabDb, seedPath);
      expect(nonemptyVocabApply.status).not.toBe(0);
      expect(nonemptyVocabApply.output).toContain(
        "EMPTY_TARGET_SEED_PRECONDITION_FAILED",
      );
      expect(
        psql(
          ctx.port,
          nonemptyVocabDb,
          "select count(*)::int from public.vocabulary_source_entries;",
        ),
      ).toBe("1");
      expect(
        psql(
          ctx.port,
          nonemptyVocabDb,
          "select canonical_key from public.vocabulary_source_entries;",
        ),
      ).toBe("src-empty-target-seed-fixture");
      expect(readCounts(ctx.port, nonemptyVocabDb).learner).toEqual([
        0, 0, 0, 0, 0, 0,
      ]);

      const nonemptyLearnerDb = ctx.createDatabase();
      applyBaseline(ctx.port, nonemptyLearnerDb);
      psql(
        ctx.port,
        nonemptyLearnerDb,
        `
          insert into public.game_sessions (
            id, user_id, game_type, plan_id, status, state
          ) values (
            '00000000-0000-4000-8000-0000000000bb',
            '00000000-0000-4000-8000-0000000000cc',
            'RANGER_TRIAL',
            'empty-target-seed-fixture',
            'active',
            '{"stateVersion":"v1"}'::jsonb
          );
        `,
      );
      const nonemptyLearnerApply = applySqlFile(
        ctx.port,
        nonemptyLearnerDb,
        seedPath,
      );
      expect(nonemptyLearnerApply.status).not.toBe(0);
      expect(nonemptyLearnerApply.output).toContain(
        "EMPTY_TARGET_SEED_PRECONDITION_FAILED",
      );
      const afterE = readCounts(ctx.port, nonemptyLearnerDb);
      expect(afterE.vocabulary).toEqual([0, 0, 0, 0]);
      expect(afterE.learner).toEqual([0, 1, 0, 0, 0, 0]);
      expect(
        psql(
          ctx.port,
          nonemptyLearnerDb,
          "select plan_id from public.game_sessions;",
        ),
      ).toBe("empty-target-seed-fixture");

      const firstLexeme = loadEffectiveVocabularySeedRows().rows.lexemes[0]!;
      const originalLemma = String(firstLexeme.lemma);
      const driftedSeed = committedSeed.replace(
        `(${sqlQuote(String(firstLexeme.id))}, ${sqlQuote(String(firstLexeme.canonical_key))}, ${sqlQuote(String(firstLexeme.source_entry_id))}, ${String(firstLexeme.source_index)}, ${sqlQuote(originalLemma)},`,
        `(${sqlQuote(String(firstLexeme.id))}, ${sqlQuote(String(firstLexeme.canonical_key))}, ${sqlQuote(String(firstLexeme.source_entry_id))}, ${String(firstLexeme.source_index)}, ${sqlQuote(`${originalLemma}-drift`)},`,
      );
      expect(driftedSeed).not.toBe(committedSeed);
      const driftDb = ctx.createDatabase();
      applyBaseline(ctx.port, driftDb);
      const driftFile = writeTempSql(driftedSeed);
      const driftApply = applySqlFile(ctx.port, driftDb, driftFile.file);
      driftFile.cleanup();
      expect(driftApply.status).toBe(0);
      const afterF = readCounts(ctx.port, driftDb);
      expect(afterF.vocabulary).toEqual(afterA.vocabulary);
      expect(afterF.learner).toEqual([0, 0, 0, 0, 0, 0]);
      expect(readFingerprint(ctx.port, driftDb)).not.toBe(
        EXPECTED_VOCABULARY_CONTENT_FINGERPRINT,
      );

      return { fingerprint };
    });

    expect(result.fingerprint).toBe(EXPECTED_VOCABULARY_CONTENT_FINGERPRINT);
    expect(teardown.clusterStopped).toBe(true);
    expect(teardown.portClosed).toBe(true);
    expect(teardown.clusterRemoved).toBe(true);
    expect(teardown.fixtureWorkdirsRemoved).toBe(true);
  });
});

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
