import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import {
  fingerprintVocabularyImportRows,
} from "@/server/vocabulary/import/rebuild-contract";
import {
  COMMIT_CONFIRMED,
  COMMIT_OUTCOME_UNKNOWN,
  COMMIT_RECONCILED_COMPLETE,
  COMMIT_RECONCILED_ROLLED_BACK,
  COMMIT_RECONCILIATION_FAILED,
  EXPECTED_CONTENT_FINGERPRINT,
  EXPECTED_FINGERPRINT_VERSION,
  EXPECTED_LEXEMES,
  EXPECTED_RELATIONS,
  EXPECTED_SOURCE_ENTRIES,
  EXPECTED_TAGS,
  REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
  actionsAfterReconciliationFailed,
  actionsAfterUnknownCommit,
  assertSameTransactionConnection,
  classifyCommitAck,
  classifyReconciliation,
  normalizeObservedVocabularyRows,
  plannedCountAndLearnerGuardSql,
  plannedInitialEmptyGuardSql,
  plannedPrivilegeProbeSql,
  plannedReadbackSql,
  plannedTransactionPrefix,
  plannedVocabularyUpserts,
  refuseRemoteTransactionalImport,
  refuseResendCommit,
  refuseRetryAfterUnknownCommit,
} from "@/server/vocabulary/import/transactional-direct-postgres-plan";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import {
  isTransactionalDirectPostgresImportLive,
  requireLocalPostgresql16,
} from "./dedicated-vocabulary-transactional-direct-postgres-import-live-gate";
import {
  buildChildEnv,
  findPostgresBin,
  postgresHarnessAvailable,
  withDisposablePostgres,
} from "./dedicated-baseline-history-atomicity-harness";

const LIVE = isTransactionalDirectPostgresImportLive();
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const DENIED_CHILD_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "PGSERVICE",
  "PGSERVICEFILE",
  "PGPASSFILE",
  "PGSSLMODE",
  "PGOPTIONS",
  "PGAPPNAME",
  "PGREQUIRESSL",
  "PGSSLROOTCERT",
  "VERCEL_ORG_ID",
] as const;
const DENIED_CHILD_ENV_PREFIXES = [
  "SUPABASE_",
  "NEXT_PUBLIC_SUPABASE_",
  "POSTGRES_",
  "VERCEL_",
] as const;

function isolatedChildEnv(): NodeJS.ProcessEnv {
  const env = buildChildEnv();
  const leaked = [
    ...DENIED_CHILD_ENV.filter((key) => Object.hasOwn(env, key)),
    ...Object.keys(env).filter((key) =>
      DENIED_CHILD_ENV_PREFIXES.some((prefix) => key.startsWith(prefix)),
    ),
  ];
  expect(leaked).toEqual([]);
  return env;
}

function psqlOnce(port: number, database: string, sql: string): string {
  const bin = findPostgresBin("psql");
  requireLocalPostgresql16(bin !== null);
  const result = spawnSync(
    bin!,
    [
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
    ],
    { encoding: "utf8", env: isolatedChildEnv() },
  );
  if (result.status !== 0) {
    throw new Error(`PSQL_FAILED ${classifySqlstate(result.stderr || result.stdout || "")}`);
  }
  return (result.stdout || "").trim();
}

function classifySqlstate(text: string): string {
  const match = text.match(/SAFE_FAIL state=([0-9A-Z]{5})|SQLSTATE[:\s]+([0-9A-Z]{5})|ERROR:\s+\w+:\s+([0-9A-Z]{5})|undefined_column/);
  if (match?.[1] || match?.[2] || match?.[3]) {
    return match[1] ?? match[2] ?? match[3] ?? "NO_SQLSTATE";
  }
  if (/undefined.column|42703|does not exist/i.test(text)) return "42703";
  if (/PRECOMMIT_COUNT_MISMATCH/.test(text)) return "COUNT_MISMATCH";
  if (/LEARNER_TABLES_NOT_ZERO/.test(text)) return "LEARNER_NOT_ZERO";
  if (/ROLE_CONTRACT_MISMATCH/.test(text)) return "ROLE_MISMATCH";
  return "NO_SQLSTATE";
}

function applyBaseline(port: number, database: string): void {
  psqlOnce(
    port,
    database,
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
  );
  const work = mkdtempSync(path.join(tmpdir(), "wr-tx-import-"));
  const baselineFile = path.join(work, "baseline.sql");
  writeFileSync(baselineFile, readFileSync(path.join(process.cwd(), BASELINE)));
  const applyBin = findPostgresBin("psql");
  requireLocalPostgresql16(applyBin !== null);
  const apply = spawnSync(
    applyBin!,
    [
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
      baselineFile,
    ],
    { encoding: "utf8", env: isolatedChildEnv() },
  );
  rmSync(work, { recursive: true, force: true });
  if (apply.status !== 0) {
    throw new Error("BASELINE_APPLY_FAILED");
  }
}

class PsqlSession {
  readonly connectionId: string;
  private readonly child: ChildProcessWithoutNullStreams;
  private stdout = "";
  private stderr = "";
  private closed: Promise<number>;

  constructor(port: number, database: string) {
    this.connectionId = randomBytes(8).toString("hex");
    const bin = findPostgresBin("psql");
    requireLocalPostgresql16(bin !== null);
    this.child = spawn(
      bin!,
      [
        "-X",
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
        "-q",
      ],
      { env: isolatedChildEnv() },
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

  private async waitToken(token: string): Promise<void> {
    const started = Date.now();
    while (!this.stdout.includes(token)) {
      if (this.child.exitCode !== null) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        const text = `${this.stderr}\n${this.stdout}`;
        const errorLines = text
          .split(/\r?\n/)
          .filter((line) => /^(ERROR|FATAL|PANIC):/i.test(line))
          .map((line) => line.slice(0, 180))
          .slice(0, 3)
          .join(" | ");
        throw new Error(
          `PSQL_SESSION_FAILED ${classifySqlstate(text)} ${errorLines || "NO_ERROR_LINE"}`,
        );
      }
      if (Date.now() - started > 120_000) {
        throw new Error("PSQL_SESSION_TIMEOUT");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    this.stdout = this.stdout.slice(this.stdout.indexOf(token) + token.length);
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

  async execFile(sql: string, dest: string): Promise<void> {
    writeFileSync(dest, sql.endsWith(";") ? `${sql}\n` : `${sql};\n`);
    await this.exec(`\\i ${dest}`);
  }

  async queryToFile(sql: string, dest: string): Promise<string> {
    const token = `OK_${randomBytes(4).toString("hex")}`;
    this.write(`\\o ${dest}\n${sql};\n\\o\n\\echo ${token}\n`);
    await this.waitToken(token);
    return readFileSync(dest, "utf8").trim();
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

async function reconcileReadonly(
  port: number,
  database: string,
  dest: string,
): Promise<{
  connectionId: string;
  class: ReturnType<typeof classifyReconciliation>;
}> {
  const session = new PsqlSession(port, database);
  const countLine = await session.queryToFile(
    `
    select
      cast((select count(*) from public.vocabulary_source_entries) as text) || ',' ||
      cast((select count(*) from public.lexemes) as text) || ',' ||
      cast((select count(*) from public.lexeme_relations) as text) || ',' ||
      cast((select count(*) from public.lexeme_tags) as text) || ',' ||
      cast((
        (select count(*) from public.learning_tasks) +
        (select count(*) from public.game_sessions) +
        (select count(*) from public.learning_evidence) +
        (select count(*) from public.student_lexeme_models) +
        (select count(*) from public.student_lexeme_skill_states) +
        (select count(*) from public.student_lexeme_weaknesses)
      ) as text)
    `,
    `${dest}.counts`,
  );
  const [source, lexemes, relations, tags, learner] = countLine.split(",");
  let fingerprint = "UNREAD";
  if (source === "0" && lexemes === "0" && relations === "0" && tags === "0") {
    fingerprint = "0".repeat(64);
  } else {
    const raw = await session.queryToFile(plannedReadbackSql(), dest);
    const parsed = JSON.parse(raw) as {
      sourceEntries: Record<string, unknown>[];
      lexemes: Record<string, unknown>[];
      relations: Record<string, unknown>[];
      tags: Record<string, unknown>[];
    };
    fingerprint = fingerprintVocabularyImportRows(
      normalizeObservedVocabularyRows(parsed),
    ).fingerprint;
  }
  await session.abort();
  return {
    connectionId: session.connectionId,
    class: classifyReconciliation({
      sourceEntries: Number(source),
      lexemes: Number(lexemes),
      relations: Number(relations),
      tags: Number(tags),
      fingerprintVersion: EXPECTED_FINGERPRINT_VERSION,
      fingerprint,
      learner: Number(learner),
    }),
  };
}

function vocabCounts(port: number, database: string): {
  source: string;
  lexemes: string;
  relations: string;
  tags: string;
  learner: string;
} {
  const line = psqlOnce(
    port,
    database,
    `
    select
      cast((select count(*) from public.vocabulary_source_entries) as text) || ',' ||
      cast((select count(*) from public.lexemes) as text) || ',' ||
      cast((select count(*) from public.lexeme_relations) as text) || ',' ||
      cast((select count(*) from public.lexeme_tags) as text) || ',' ||
      cast((
        (select count(*) from public.learning_tasks) +
        (select count(*) from public.game_sessions) +
        (select count(*) from public.learning_evidence) +
        (select count(*) from public.student_lexeme_models) +
        (select count(*) from public.student_lexeme_skill_states) +
        (select count(*) from public.student_lexeme_weaknesses)
      ) as text);
    `,
  );
  const [source, lexemes, relations, tags, learner] = line.split(",");
  return { source, lexemes, relations, tags, learner };
}

describe.skipIf(!LIVE)(
  "dedicated vocabulary transactional direct-Postgres import local PostgreSQL 16",
  () => {
    it("proves success, fault injection, and rollback without authorizing remote", async () => {
      requireLocalPostgresql16(postgresHarnessAvailable());
      expect(refuseRemoteTransactionalImport()).toBe(
        REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
      );

      const dataset = loadVocabularyDataset();
      const rows = toVocabularyImportRows(dataset);
      const expected = fingerprintVocabularyImportRows(rows);
      expect(expected.fingerprint).toBe(EXPECTED_CONTENT_FINGERPRINT);

      const { result, teardown } = await withDisposablePostgres(async (ctx) => {
        const successDb = ctx.createDatabase();
        const columnFailDb = ctx.createDatabase();
        const fingerprintFailDb = ctx.createDatabase();
        const learnerFailDb = ctx.createDatabase();
        const lostAckRollbackDb = ctx.createDatabase();
        const partialDb = ctx.createDatabase();
        for (const database of [
          successDb,
          columnFailDb,
          fingerprintFailDb,
          learnerFailDb,
          lostAckRollbackDb,
          partialDb,
        ]) {
          applyBaseline(ctx.port, database);
        }

        const work = mkdtempSync(path.join(tmpdir(), "wr-tx-session-"));
        const readbackFile = path.join(work, "readback.json");

        const success = new PsqlSession(ctx.port, successDb);
        await success.exec(plannedTransactionPrefix());
        const probe = await success.queryToFile(
          plannedPrivilegeProbeSql(),
          path.join(work, "probe.txt"),
        );
        expect(probe.startsWith("spike|service_role|t") || probe.startsWith("spike|service_role|true")).toBe(
          true,
        );
        await success.exec(plannedInitialEmptyGuardSql());
        const txConnection = success.connectionId;
        assertSameTransactionConnection(txConnection, success.connectionId);
        await success.execFile(
          plannedVocabularyUpserts(rows),
          path.join(work, "success-upserts.sql"),
        );
        await success.exec(
          plannedCountAndLearnerGuardSql({
            sourceEntries: 1600,
            lexemes: 1638,
            relations: 716,
            tags: 1638,
          }),
        );
        const raw = await success.queryToFile(plannedReadbackSql(), readbackFile);
        const parsed = JSON.parse(raw) as {
          sourceEntries: Record<string, unknown>[];
          lexemes: Record<string, unknown>[];
          relations: Record<string, unknown>[];
          tags: Record<string, unknown>[];
        };
        const observed = fingerprintVocabularyImportRows(
          normalizeObservedVocabularyRows(parsed),
        );
        expect(observed.fingerprint).toBe(EXPECTED_CONTENT_FINGERPRINT);
        await success.end("commit");
        const commitClass = classifyCommitAck("ok");
        expect(commitClass).toBe(COMMIT_CONFIRMED);

        const afterSuccess = vocabCounts(ctx.port, successDb);
        expect(afterSuccess).toEqual({
          source: String(EXPECTED_SOURCE_ENTRIES),
          lexemes: String(EXPECTED_LEXEMES),
          relations: String(EXPECTED_RELATIONS),
          tags: String(EXPECTED_TAGS),
          learner: "0",
        });
        const confirmedReconcile = await reconcileReadonly(
          ctx.port,
          successDb,
          path.join(work, "success-reconcile.json"),
        );
        expect(confirmedReconcile.class).toBe(COMMIT_RECONCILED_COMPLETE);
        expect(confirmedReconcile.connectionId).not.toBe(txConnection);
        expect(
          psqlOnce(
            ctx.port,
            successDb,
            "select to_regclass('supabase_migrations.schema_migrations') is null",
          ),
        ).toMatch(/^[tf]|true|false$/);

        const columnFail = new PsqlSession(ctx.port, columnFailDb);
        let columnState = "NO_ERROR";
        try {
          await columnFail.exec(plannedTransactionPrefix());
          await columnFail.exec(
            `
            insert into public.vocabulary_source_entries (
              id, canonical_key, source_index, source_word_raw, not_a_real_column
            ) values (
              '00000000-0000-4000-8000-0000000000aa',
              'tx-proof-undefined-column',
              0,
              'x',
              'no'
            )
            `,
          );
          await columnFail.end("commit");
        } catch (error) {
          columnState = error instanceof Error ? error.message : "NO_ERROR";
          await columnFail.abort();
        }
        expect(columnState).toContain("42703");
        expect(vocabCounts(ctx.port, columnFailDb)).toEqual({
          source: "0",
          lexemes: "0",
          relations: "0",
          tags: "0",
          learner: "0",
        });

        const fingerprintFail = new PsqlSession(ctx.port, fingerprintFailDb);
        await fingerprintFail.exec(plannedTransactionPrefix());
        await fingerprintFail.execFile(
          plannedVocabularyUpserts(rows),
          path.join(work, "fingerprint-upserts.sql"),
        );
        await fingerprintFail.exec(
          "update public.vocabulary_source_entries set source_word_raw = source_word_raw || 'x' where source_index = 1",
        );
        const drifted = JSON.parse(
          await fingerprintFail.queryToFile(
            plannedReadbackSql(),
            path.join(work, "drift.json"),
          ),
        ) as {
          sourceEntries: Record<string, unknown>[];
          lexemes: Record<string, unknown>[];
          relations: Record<string, unknown>[];
          tags: Record<string, unknown>[];
        };
        expect(
          fingerprintVocabularyImportRows(normalizeObservedVocabularyRows(drifted))
            .fingerprint,
        ).not.toBe(EXPECTED_CONTENT_FINGERPRINT);
        await fingerprintFail.end("rollback");
        expect(vocabCounts(ctx.port, fingerprintFailDb)).toEqual({
          source: "0",
          lexemes: "0",
          relations: "0",
          tags: "0",
          learner: "0",
        });

        const firstLexemeId = String(rows.lexemes[0]?.id ?? "");
        const learnerFail = new PsqlSession(ctx.port, learnerFailDb);
        let learnerState = "NO_ERROR";
        try {
          await learnerFail.exec(plannedTransactionPrefix());
          await learnerFail.execFile(
            plannedVocabularyUpserts(rows),
            path.join(work, "learner-upserts.sql"),
          );
          await learnerFail.exec(
            `
            insert into public.learning_evidence (
              user_id, lexeme_id, skill, prompt_mode, answer_mode, outcome,
              difficulty, occurred_at
            ) values (
              '00000000-0000-4000-8000-000000000001',
              '${firstLexemeId}',
              'MEANING_RECOGNITION',
              'WORD_TO_MEANING',
              'CHOICE',
              'INDEPENDENT_CORRECT',
              0.5,
              now()
            )
            `,
          );
          await learnerFail.exec(
            plannedCountAndLearnerGuardSql({
              sourceEntries: 1600,
              lexemes: 1638,
              relations: 716,
              tags: 1638,
            }),
          );
          await learnerFail.end("commit");
        } catch (error) {
          learnerState = error instanceof Error ? error.message : "NO_ERROR";
          try {
            await learnerFail.end("rollback");
          } catch {
            await learnerFail.abort();
          }
        }
        expect(learnerState).toContain("LEARNER_NOT_ZERO");
        expect(vocabCounts(ctx.port, learnerFailDb)).toEqual({
          source: "0",
          lexemes: "0",
          relations: "0",
          tags: "0",
          learner: "0",
        });

        const lostAckSucceeded = classifyCommitAck("transport_error");
        expect(lostAckSucceeded).toBe(COMMIT_OUTCOME_UNKNOWN);
        expect(refuseRetryAfterUnknownCommit()).toBe(
          "RETRY_AFTER_UNKNOWN_COMMIT_REJECTED",
        );
        expect(refuseResendCommit()).toBe("RESEND_COMMIT_REJECTED");
        expect(actionsAfterUnknownCommit().retryImport).toBe(false);
        expect(actionsAfterUnknownCommit().requireNewConnection).toBe(true);
        const unknownComplete = await reconcileReadonly(
          ctx.port,
          successDb,
          path.join(work, "unknown-complete.json"),
        );
        expect(unknownComplete.class).toBe(COMMIT_RECONCILED_COMPLETE);
        expect(unknownComplete.connectionId).not.toBe(txConnection);

        const lostRollback = new PsqlSession(ctx.port, lostAckRollbackDb);
        await lostRollback.exec(plannedTransactionPrefix());
        await lostRollback.execFile(
          plannedVocabularyUpserts(rows),
          path.join(work, "lost-rollback-upserts.sql"),
        );
        await lostRollback.abort();
        expect(classifyCommitAck("transport_error")).toBe(COMMIT_OUTCOME_UNKNOWN);
        const unknownRolledBack = await reconcileReadonly(
          ctx.port,
          lostAckRollbackDb,
          path.join(work, "unknown-rollback.json"),
        );
        expect(unknownRolledBack.class).toBe(COMMIT_RECONCILED_ROLLED_BACK);
        expect(unknownRolledBack.connectionId).not.toBe(lostRollback.connectionId);
        expect(vocabCounts(ctx.port, lostAckRollbackDb)).toEqual({
          source: "0",
          lexemes: "0",
          relations: "0",
          tags: "0",
          learner: "0",
        });

        psqlOnce(
          ctx.port,
          partialDb,
          `
          insert into public.vocabulary_source_entries (
            id, canonical_key, source_index, source_word_raw
          ) values (
            '00000000-0000-4000-8000-0000000000bb',
            'tx-proof-partial-only',
            1,
            'partial'
          );
          `,
        );
        const failedReconcile = await reconcileReadonly(
          ctx.port,
          partialDb,
          path.join(work, "partial-reconcile.json"),
        );
        expect(failedReconcile.class).toBe(COMMIT_RECONCILIATION_FAILED);
        expect(actionsAfterReconciliationFailed().retryImport).toBe(false);
        expect(actionsAfterReconciliationFailed().deleteRows).toBe(false);
        expect(actionsAfterReconciliationFailed().repair).toBe(false);
        expect(vocabCounts(ctx.port, partialDb).source).toBe("1");

        rmSync(work, { recursive: true, force: true });
        expect(existsSync(work)).toBe(false);

        return {
          version: ctx.postgresVersion,
          remote: refuseRemoteTransactionalImport(),
        };
      });

      expect(result.version.startsWith("16.")).toBe(true);
      expect(result.remote).toBe(REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED);
      expect(teardown.clusterStopped).toBe(true);
      expect(teardown.portClosed).toBe(true);
      expect(teardown.clusterRemoved).toBe(true);
      expect(teardown.fixtureWorkdirsRemoved).toBe(true);
    }, 180_000);
  },
);
