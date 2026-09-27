import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import {
  buildChildEnv,
  findPostgresBin,
  postgresHarnessAvailable,
  withDisposablePostgres,
} from "./dedicated-baseline-history-atomicity-harness";

const LIVE = process.env.RUN_DEDICATED_GATE_B_SOURCE_ENTRIES_DIAGNOSIS === "1";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";
const IMPORTER_FIELDS = [
  "id",
  "canonical_key",
  "source_index",
  "section",
  "source_page_start",
  "source_page_end",
  "source_word_raw",
  "starred",
  "source_ipa_raw",
  "source_pos_raw",
  "source_meaning_raw",
  "raw_entry",
  "parse_status",
  "parse_issues",
  "source_review_note",
] as const;
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
  "PGOPTIONS",
  "VERCEL_ORG_ID",
] as const;

function childEnv(): NodeJS.ProcessEnv {
  return buildChildEnv();
}

function assertIsolatedChildEnv(env: NodeJS.ProcessEnv): void {
  for (const key of DENIED_CHILD_ENV) {
    expect(env[key], key).toBeUndefined();
  }
}

function psql(port: number, database: string, sql: string): string {
  const bin = findPostgresBin("psql");
  if (!bin) {
    throw new Error("LOCAL_POSTGRESQL_16_REQUIRED");
  }
  const env = childEnv();
  assertIsolatedChildEnv(env);
  const result = spawnSync(
    bin,
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
    { encoding: "utf8", env },
  );
  if (result.status !== 0) {
    const text = `${result.stderr || ""} ${result.stdout || ""}`;
    const state = text.match(
      /SAFE_FAIL state=([0-9A-Z]{5})|SQLSTATE[:\s]+([0-9A-Z]{5})/,
    );
    throw new Error(`PSQL_FAILED ${state?.[1] ?? state?.[2] ?? "NO_SQLSTATE"}`);
  }
  return (result.stdout || "").trim();
}

describe.skipIf(!LIVE)(
  "dedicated Gate B source-entries diagnosis local PostgreSQL 16",
  () => {
    it("reproduces the first batch with the service-role model and PK conflict target", async () => {
      if (!postgresHarnessAvailable()) {
        throw new Error("LOCAL_POSTGRESQL_16_REQUIRED");
      }

      const rows = toVocabularyImportRows(
        loadVocabularyDataset(),
      ).sourceEntries.slice(0, 200);
      const payload = JSON.stringify(rows);
      if (payload.includes("$wr_payload$")) {
        throw new Error("PAYLOAD_DELIMITER_COLLISION");
      }
      const updateSet = IMPORTER_FIELDS.filter((column) => column !== "id")
        .map((column) => `${column} = EXCLUDED.${column}`)
        .join(", ");
      const recordTypes = [
        "id uuid",
        "canonical_key text",
        "source_index integer",
        "section text",
        "source_page_start integer",
        "source_page_end integer",
        "source_word_raw text",
        "starred boolean",
        "source_ipa_raw text",
        "source_pos_raw text",
        "source_meaning_raw text",
        "raw_entry text",
        "parse_status text",
        "parse_issues jsonb",
        "source_review_note text",
      ].join(", ");

      const { result, teardown } = await withDisposablePostgres(async (ctx) => {
        const database = ctx.createDatabase();
        psql(
          ctx.port,
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
              create role service_role nologin nosuperuser noinherit;
            end if;
          end
          $$;
          `,
        );
        const work = mkdtempSync(path.join(tmpdir(), "wr-gateb-local-"));
        const baselineFile = path.join(work, "baseline.sql");
        writeFileSync(
          baselineFile,
          readFileSync(path.join(process.cwd(), BASELINE)),
        );
        const apply = spawnSync(
          findPostgresBin("psql")!,
          [
            "-h",
            "127.0.0.1",
            "-p",
            String(ctx.port),
            "-U",
            "spike",
            "-d",
            database,
            "-v",
            "ON_ERROR_STOP=1",
            "-f",
            baselineFile,
          ],
          { encoding: "utf8", env: childEnv() },
        );
        rmSync(work, { recursive: true, force: true });
        expect(existsSync(work)).toBe(false);
        if (apply.status !== 0) {
          throw new Error("BASELINE_APPLY_FAILED");
        }

        const privileges = psql(
          ctx.port,
          database,
          `
          select
            has_table_privilege('service_role', 'public.vocabulary_source_entries', 'SELECT')
            || ',' ||
            has_table_privilege('service_role', 'public.vocabulary_source_entries', 'INSERT')
            || ',' ||
            has_table_privilege('service_role', 'public.vocabulary_source_entries', 'UPDATE')
            || ',' ||
            has_table_privilege('service_role', 'public.vocabulary_source_entries', 'DELETE');
          `,
        );
        expect(["t,t,t,f", "true,true,true,false"]).toContain(privileges);
        expect(
          psql(
            ctx.port,
            database,
            `
            select count(*) from information_schema.columns
            where table_schema = 'public'
              and table_name = 'vocabulary_source_entries';
            `,
          ),
        ).toBe("16");

        psql(
          ctx.port,
          database,
          `
          begin;
          set role service_role;
          do $body$
          declare
            state text;
            cons text;
          begin
            begin
              insert into public.vocabulary_source_entries (
                ${IMPORTER_FIELDS.join(", ")}
              )
              select *
              from json_to_recordset(($wr_payload$${payload}$wr_payload$)::json) as x(${recordTypes})
              on conflict (id) do update set ${updateSet};
            exception when others then
              get stacked diagnostics state = returned_sqlstate, cons = constraint_name;
              raise exception 'SAFE_FAIL state=% constraint=%', state, coalesce(cons, '');
            end;
          end
          $body$;
          reset role;
          commit;
          `,
        );
        return {
          version: ctx.postgresVersion,
          count: psql(
            ctx.port,
            database,
            "select count(*) from public.vocabulary_source_entries;",
          ),
          createdAtNulls: psql(
            ctx.port,
            database,
            "select count(*) from public.vocabulary_source_entries where created_at is null;",
          ),
          learner: psql(
            ctx.port,
            database,
            "select count(*) from public.learning_tasks;",
          ),
        };
      });

      expect(result.version.startsWith("16.")).toBe(true);
      expect(result.count).toBe("200");
      expect(result.createdAtNulls).toBe("0");
      expect(result.learner).toBe("0");
      expect(teardown.clusterStopped).toBe(true);
      expect(teardown.portClosed).toBe(true);
      expect(teardown.clusterRemoved).toBe(true);
      expect(teardown.fixtureWorkdirsRemoved).toBe(true);
    }, 120_000);
  },
);
