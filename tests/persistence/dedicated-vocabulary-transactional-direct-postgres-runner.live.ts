import { spawnSync } from "node:child_process";
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
import { REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED } from "@/server/vocabulary/import/transactional-direct-postgres-plan";
import {
  createLoopbackPsqlSession,
  runTransactionalDirectPostgresCli,
} from "@/server/vocabulary/import/transactional-direct-postgres-runner";
import {
  isTransactionalDirectPostgresRunnerLive,
  requireLocalPostgresql16,
} from "./dedicated-vocabulary-transactional-direct-postgres-runner-live-gate";
import {
  buildChildEnv,
  findPostgresBin,
  postgresHarnessAvailable,
  withDisposablePostgres,
} from "./dedicated-baseline-history-atomicity-harness";

const LIVE = isTransactionalDirectPostgresRunnerLive();
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";

function isolatedChildEnv(): NodeJS.ProcessEnv {
  const env = buildChildEnv();
  const leaked = Object.keys(env).filter((key) =>
    /^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|POSTGRES_|VERCEL_|DATABASE_URL|DIRECT_URL)/.test(
      key,
    ),
  );
  expect(leaked).toEqual([]);
  return env;
}

function applyBaseline(port: number, database: string): void {
  const bin = findPostgresBin("psql");
  requireLocalPostgresql16(bin !== null);
  const bootstrap = spawnSync(
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
    ],
    { encoding: "utf8", env: isolatedChildEnv() },
  );
  if (bootstrap.status !== 0) {
    throw new Error("BASELINE_ROLE_FAILED");
  }
  const work = mkdtempSync(path.join(tmpdir(), "wr-runner-"));
  const baselineFile = path.join(work, "baseline.sql");
  writeFileSync(baselineFile, readFileSync(path.join(process.cwd(), BASELINE)));
  const apply = spawnSync(
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
      "-f",
      baselineFile,
    ],
    { encoding: "utf8", env: isolatedChildEnv() },
  );
  const history = spawnSync(
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
      "-c",
      `
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        name text
      );
      insert into supabase_migrations.schema_migrations (version, name)
      values ('202609260001', 'dedicated_wordranger_baseline_v0')
      on conflict (version) do update set name = excluded.name;
      grant usage on schema supabase_migrations to service_role;
      grant select on supabase_migrations.schema_migrations to service_role;
      `,
    ],
    { encoding: "utf8", env: isolatedChildEnv() },
  );
  rmSync(work, { recursive: true, force: true });
  if (apply.status !== 0 || history.status !== 0) {
    throw new Error("BASELINE_APPLY_FAILED");
  }
}

describe.skipIf(!LIVE)(
  "dedicated transactional direct-Postgres runner local PostgreSQL 16",
  () => {
    it("verifies fingerprint, validate, preflight, dry-run rollback, and apply refuse", async () => {
      requireLocalPostgresql16(postgresHarnessAvailable());
      const fingerprint = await runTransactionalDirectPostgresCli(
        ["--fingerprint"],
        {},
      );
      expect(fingerprint.exitCode).toBe(0);
      expect(fingerprint.class).toBe("FINGERPRINT_PRINTED");

      const validated = await runTransactionalDirectPostgresCli(
        ["--validate"],
        {},
      );
      expect(validated.exitCode).toBe(0);
      expect(validated.class).toBe("LOCAL_CONTENT_VALID");

      const apply = await runTransactionalDirectPostgresCli(
        ["--apply"],
        { ALLOW_REMOTE_TRANSACTIONAL_IMPORT: "1" },
      );
      expect(apply.exitCode).toBe(1);
      expect(apply.class).toBe(REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED);

      const { result, teardown } = await withDisposablePostgres(async (ctx) => {
        const database = ctx.createDatabase();
        applyBaseline(ctx.port, database);
        const preflight = await runTransactionalDirectPostgresCli(
          ["--preflight"],
          {},
          undefined,
          {
            preflightSession: async () =>
              createLoopbackPsqlSession({
                port: ctx.port,
                database,
                user: "spike",
                bin: findPostgresBin("psql") ?? undefined,
              }),
          },
        );
        expect(preflight.exitCode).toBe(0);
        expect(preflight.class).toBe("READONLY_PREFLIGHT_COMPLETE");

        const dryRun = await runTransactionalDirectPostgresCli(
          ["--dry-run"],
          {},
          undefined,
          {
            dryRunSession: async () =>
              createLoopbackPsqlSession({
                port: ctx.port,
                database,
                user: "spike",
                bin: findPostgresBin("psql") ?? undefined,
              }),
          },
        );
        expect(dryRun.exitCode).toBe(0);
        expect(dryRun.class).toBe("LOCAL_DRY_RUN_ROLLED_BACK");

        const after = await runTransactionalDirectPostgresCli(
          ["--preflight"],
          {},
          undefined,
          {
            preflightSession: async () =>
              createLoopbackPsqlSession({
                port: ctx.port,
                database,
                user: "spike",
                bin: findPostgresBin("psql") ?? undefined,
              }),
          },
        );
        expect(after.class).toBe("READONLY_PREFLIGHT_COMPLETE");
        return { remote: apply.class };
      });

      expect(result.remote).toBe(REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED);
      expect(teardown.clusterStopped).toBe(true);
      expect(teardown.portClosed).toBe(true);
      expect(teardown.clusterRemoved).toBe(true);
      expect(existsSync).toBeTypeOf("function");
    }, 240_000);
  },
);
