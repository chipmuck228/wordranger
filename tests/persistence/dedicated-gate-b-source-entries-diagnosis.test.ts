import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import {
  findPostgresBin,
  postgresHarnessAvailable,
  withDisposablePostgres,
} from "./dedicated-baseline-history-atomicity-harness";

const EVIDENCE = "docs/DEDICATED_WORDRANGER_GATE_B_SOURCE_ENTRIES_DIAGNOSIS.md";
const ORIGIN_MAIN = "a031be4ba791af9ac68aad93e8aba9f3437128cf";
const INSPECTED_HEAD = "db6cc6552b280f7b137d88e28888f000cc9aa2db";
const EVIDENCE_HEAD = "a6cd97997115ae6e0b914b41077e58fad1de0e9a";
const FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";
const PRODUCTION_ALIAS_FULL =
  "782ffcca670c8272a3ba7ca07bedaef4debdc95f";
const APPLY_IMPORT = "src/server/vocabulary/import/apply-import.ts";
const BATCH_ERROR = "src/server/vocabulary/import/batch-error.ts";
const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";

const LOCKED_SHA256 = {
  [BASELINE]:
    "7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe",
  [APPLY_IMPORT]:
    "22ec38aa8a0ac163c56503470662eb652c71621e535d7cb426a7bc0cbafef74f",
  "src/server/vocabulary/import/import-rows.ts":
    "44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36",
  [BATCH_ERROR]:
    "f36361f763a04cc5682841bb1c856fc2cc130506d236f6216ebfb656091b807b",
} as const;

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

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), file)))
    .digest("hex");
}

function psql(port: number, database: string, sql: string): string {
  const bin = findPostgresBin("psql");
  if (!bin) {
    throw new Error("psql missing");
  }
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
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    const text = `${result.stderr || ""} ${result.stdout || ""}`;
    const state = text.match(/SAFE_FAIL state=([0-9A-Z]{5})|SQLSTATE[:\s]+([0-9A-Z]{5})/);
    throw new Error(`PSQL_FAILED ${state?.[1] ?? state?.[2] ?? "NO_SQLSTATE"}`);
  }
  return (result.stdout || "").trim();
}

describe("dedicated Gate B source-entries diagnosis", () => {
  const text = readFileSync(path.join(process.cwd(), EVIDENCE), "utf8");
  const applyImport = readFileSync(path.join(process.cwd(), APPLY_IMPORT), "utf8");

  it("locks catalog-match diagnosis without authorizing a third apply", () => {
    expect(text).toMatch(/Candidate \/ Not a Standard/);
    expect(text).toContain("Local diagnosis of the stable first-batch");
    expect(text).toContain("SOURCE_ENTRIES_UPSERT");
    expect(text).toContain("This task did not run `scripts/import-vocabulary.ts --apply`.");
    expect(text).toContain("A third import attempt is not authorized.");
    expect(text).toContain("LOCAL_CONTRACT_MATCHES_REMOTE_CATALOG");
    expect(text).toContain("REMOTE_POSTGREST_WRITE_PATH_REMAINS_SUSPECT");
    expect(text).toContain("THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED");
    expect(text).toContain("PR_17_REMAINS_UNMERGED");
    expect(text).toContain("PRODUCTION_REMAINS_ON_782FFCC");
    expect(text).toContain(ORIGIN_MAIN);
    expect(text).toContain(INSPECTED_HEAD);
    expect(text).toContain(EVIDENCE_HEAD);
    expect(text).toContain(FINGERPRINT);
    expect(text).toContain(PRODUCTION_ALIAS_FULL);
    expect(text).toContain("providerCode");
    expect(text).toContain("HTTP_4XX");
    expect(text).toContain("HTTP_5XX");
    expect(text).toContain("NO_STATUS");
    expect(text).toContain("json_to_recordset");
    expect(text).toContain("ON CONFLICT (id)");
    expect(text).toContain("PostgreSQL **16.15**");
    expect(text).toContain("first batch inserted `200` rows");
    expect(text).not.toContain("GATE_B_VOCABULARY_IMPORTED");
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/supabase\.co|eyj|postgres:\/\//i);
    expect(text).not.toMatch(UUID_RE);
    expect(text).not.toMatch(/\/Users\/|\/tmp\/|\/private\/tmp\//);
    expect(text).not.toMatch(/PR #17 was merged/i);
  });

  it("locks current hashes and the unspecified upsert call", () => {
    for (const [file, expected] of Object.entries(LOCKED_SHA256)) {
      expect(text, file).toContain(expected);
      expect(sha256(file), file).toBe(expected);
    }
    expect(applyImport).toContain("client.from(table).upsert(slice)");
    expect(applyImport).not.toMatch(/onConflict/);
    expect(applyImport).not.toMatch(/returning:/);
    expect(applyImport).not.toMatch(/db:\s*['\"]/);
  });

  it("reproduces the first batch on local PostgreSQL 16 with the PK conflict target", async () => {
    expect(postgresHarnessAvailable()).toBe(true);
    const rows = toVocabularyImportRows(loadVocabularyDataset()).sourceEntries.slice(
      0,
      200,
    );
    expect(rows).toHaveLength(200);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([...IMPORTER_FIELDS].sort());
    expect(rows.some((row) => Object.values(row).includes(undefined))).toBe(false);
    const payload = JSON.stringify(rows);
    expect(payload.includes("$wr_payload$")).toBe(false);
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
      writeFileSync(baselineFile, readFileSync(path.join(process.cwd(), BASELINE)));
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
        { encoding: "utf8" },
      );
      rmSync(work, { recursive: true, force: true });
      expect(apply.status).toBe(0);
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
        learner: psql(ctx.port, database, "select count(*) from public.learning_tasks;"),
      };
    });

    expect(result.version.startsWith("16.")).toBe(true);
    expect(result.count).toBe("200");
    expect(result.createdAtNulls).toBe("0");
    expect(result.learner).toBe("0");
    expect(teardown.clusterStopped).toBe(true);
    expect(teardown.clusterRemoved).toBe(true);
    expect(teardown.portClosed).toBe(true);
  }, 120_000);
});
