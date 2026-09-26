import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import { buildVocabularyRebuildManifest } from "@/server/vocabulary/import/rebuild-contract";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

const BASELINE =
  "supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql";

const LEARNER_TABLES = [
  "learning_tasks",
  "game_sessions",
  "learning_evidence",
  "student_lexeme_models",
  "student_lexeme_skill_states",
  "student_lexeme_weaknesses",
] as const;

const REQUIRED_TABLES = [
  "vocabulary_source_entries",
  "lexemes",
  "lexeme_relations",
  "lexeme_tags",
  ...LEARNER_TABLES,
] as const;

let db: PGlite;
let baselineSql: string;
let isolatedSql: string;

function forIsolatedEngine(sql: string): string {
  // PGlite already provides gen_random_uuid and does not package pgcrypto.
  return sql.replace(
    /create extension if not exists pgcrypto;\n\n/,
    "-- pgcrypto skipped on isolated PGlite; gen_random_uuid is built-in\n\n",
  );
}

async function exec(sql: string): Promise<void> {
  await db.exec(sql);
}

async function query<T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await db.query<T>(sql, params);
  return result.rows;
}

async function scalar<T>(sql: string, params?: unknown[]): Promise<T> {
  const rows = await query<Record<string, T>>(sql, params);
  const row = rows[0];
  if (!row) {
    throw new Error(`SQL returned no rows: ${sql}`);
  }
  return Object.values(row)[0] as T;
}

async function insertRows(
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const columns = Object.keys(rows[0] ?? {});
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const sql = `insert into public.${table} (${columns.join(", ")}) values (${placeholders})`;
  for (const row of rows) {
    await db.query(
      sql,
      columns.map((column) => row[column]),
    );
  }
}

describe("dedicated baseline V0 isolated PGlite apply", () => {
  beforeAll(async () => {
    db = new PGlite();
    baselineSql = readFileSync(path.join(process.cwd(), BASELINE), "utf8");
    isolatedSql = forIsolatedEngine(baselineSql);
    await exec(`
      do $$
      begin
        if not exists (select from pg_roles where rolname = 'anon') then
          create role anon;
        end if;
        if not exists (select from pg_roles where rolname = 'authenticated') then
          create role authenticated;
        end if;
        if not exists (select from pg_roles where rolname = 'service_role') then
          create role service_role login superuser;
        end if;
      end
      $$;
    `);
    await exec(isolatedSql);
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("applies the baseline once and rejects a second create", async () => {
    expect(isolatedSql).not.toContain("create extension if not exists pgcrypto");
    expect(baselineSql).toContain("create extension if not exists pgcrypto");
    await expect(exec(isolatedSql)).rejects.toThrow(/already exists/i);
    await exec("rollback;");
  });

  it("creates required tables, trigger, and indexes without excluded objects", async () => {
    const tables = await query<{ relname: string }>(
      `select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
       order by c.relname`,
    );
    expect(tables.map((row) => row.relname)).toEqual(
      [...REQUIRED_TABLES].sort(),
    );
    const trigger = await scalar<string>(
      `select tgname from pg_trigger
       where tgname = 'learning_evidence_no_update'`,
    );
    expect(trigger).toBe("learning_evidence_no_update");
    const fn = await scalar<string>(
      `select proname from pg_proc
       where proname = 'prevent_learning_evidence_mutation'`,
    );
    expect(fn).toBe("prevent_learning_evidence_mutation");
    const cleanup = await scalar<number>(
      `select count(*)::int from pg_proc
       where proname = 'cleanup_progress_test_user'`,
    );
    expect(cleanup).toBe(0);
    const sessionFk = await scalar<number>(
      `select count(*)::int from pg_constraint
       where conname = 'learning_evidence_session_id_fkey'`,
    );
    expect(sessionFk).toBe(0);
  });

  it("enables learner RLS without FORCE, policies, or client DML", async () => {
    const rows = await query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = any($1::text[])`,
      [LEARNER_TABLES],
    );
    expect(rows).toHaveLength(LEARNER_TABLES.length);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(false);
    }
    const policies = await scalar<number>(
      `select count(*)::int from pg_policies where schemaname = 'public'`,
    );
    expect(policies).toBe(0);
    for (const table of LEARNER_TABLES) {
      const clientGrants = await scalar<number>(
        `select count(*)::int
         from information_schema.role_table_grants
         where table_schema = 'public'
           and table_name = $1
           and grantee in ('PUBLIC', 'anon', 'authenticated')`,
        [table],
      );
      expect(clientGrants, table).toBe(0);
      const service = await query<{ privilege_type: string }>(
        `select privilege_type
         from information_schema.role_table_grants
         where table_schema = 'public'
           and table_name = $1
           and grantee = 'service_role'`,
        [table],
      );
      expect(service.map((row) => row.privilege_type).sort()).toEqual(
        ["DELETE", "INSERT", "SELECT", "UPDATE"].sort(),
      );
    }
  });

  it("keeps learning_evidence append-only", async () => {
    const dataset = loadVocabularyDataset();
    const first = dataset.sourceEntries[0];
    const lexeme = dataset.lexemes.find(
      (item) => item.sourceEntryId === first?.id,
    );
    expect(first && lexeme).toBeTruthy();
    await db.query(
      `insert into public.vocabulary_source_entries
        (id, canonical_key, source_index, source_word_raw, source_meaning_raw)
       values ($1, $2, $3, $4, $5)`,
      [
        first!.id,
        first!.canonicalKey,
        first!.sourceIndex,
        first!.sourceWordRaw,
        first!.sourceMeaningRaw,
      ],
    );
    await db.query(
      `insert into public.lexemes
        (id, canonical_key, source_entry_id, source_index, lemma, display, role,
         starred, parts_of_speech, ipa, meanings_zh, forms, variants,
         quality_status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
      [
        lexeme!.id,
        lexeme!.canonicalKey,
        lexeme!.sourceEntryId,
        lexeme!.sourceIndex,
        lexeme!.lemma,
        lexeme!.display,
        lexeme!.role,
        lexeme!.starred,
        lexeme!.partsOfSpeech,
        lexeme!.ipa,
        JSON.stringify(lexeme!.meaningsZh),
        lexeme!.forms,
        lexeme!.variants,
        lexeme!.quality.status,
      ],
    );
    await db.query(
      `insert into public.learning_evidence
        (user_id, lexeme_id, skill, prompt_mode, answer_mode, outcome,
         difficulty, occurred_at)
       values ($1,$2,'MEANING_RECOGNITION','WORD_TO_MEANING','CHOICE',
               'INDEPENDENT_CORRECT', 0.5, now())`,
      ["00000000-0000-4000-8000-000000000099", lexeme!.id],
    );
    await expect(
      db.query(`update public.learning_evidence set outcome = 'INCORRECT'`),
    ).rejects.toThrow(/append-only/i);
    await expect(
      db.query(`delete from public.learning_evidence`),
    ).rejects.toThrow(/append-only/i);
  });

  it("rebuilds bundled vocabulary with a matching fingerprint", async () => {
    await exec(`
      truncate public.learning_evidence, public.lexemes, public.vocabulary_source_entries
      restart identity cascade;
    `);
    const dataset = loadVocabularyDataset();
    const expected = buildVocabularyRebuildManifest(dataset);
    const rows = toVocabularyImportRows(dataset);
    await insertRows("vocabulary_source_entries", rows.sourceEntries);
    await insertRows("lexemes", rows.lexemes);
    for (const row of rows.lexemeAbbreviationUpdates) {
      await db.query(
        `update public.lexemes
         set abbreviation_of_lexeme_id = $2
         where id = $1`,
        [row.id, row.abbreviation_of_lexeme_id],
      );
    }
    await insertRows("lexeme_relations", rows.relations);
    await insertRows("lexeme_tags", rows.tags);

    const sourceKeys = (
      await query<{ canonical_key: string }>(
        `select canonical_key from public.vocabulary_source_entries`,
      )
    ).map((row) => row.canonical_key);
    const lexemeKeys = (
      await query<{ canonical_key: string }>(
        `select canonical_key from public.lexemes`,
      )
    ).map((row) => row.canonical_key);
    const relationKeys = (
      await query<{ canonical_key: string }>(
        `select coalesce(canonical_key, '') as canonical_key from public.lexeme_relations`,
      )
    ).map((row) => row.canonical_key);
    const tagKeys = (
      await query<{ lexeme_id: string }>(
        `select lexeme_id::text as lexeme_id from public.lexeme_tags`,
      )
    ).map((row) => row.lexeme_id);
    const fingerprint = createHash("sha256")
      .update(
        [
          `sourceEntries:${[...sourceKeys].sort((a, b) => a.localeCompare(b)).join("\n")}`,
          `lexemes:${[...lexemeKeys].sort((a, b) => a.localeCompare(b)).join("\n")}`,
          `relations:${[...relationKeys].sort((a, b) => a.localeCompare(b)).join("\n")}`,
          `tags:${[...tagKeys].sort((a, b) => a.localeCompare(b)).join("\n")}`,
        ].join("\n"),
      )
      .digest("hex");

    expect(sourceKeys).toHaveLength(expected.sourceEntries);
    expect(lexemeKeys).toHaveLength(expected.lexemes);
    expect(relationKeys).toHaveLength(expected.relations);
    expect(tagKeys).toHaveLength(expected.tags);
    expect(fingerprint).toBe(expected.fingerprint);
    const learnerRows = await scalar<number>(
      `select (
         (select count(*) from public.learning_tasks) +
         (select count(*) from public.game_sessions) +
         (select count(*) from public.learning_evidence) +
         (select count(*) from public.student_lexeme_models)
       )::int`,
    );
    expect(learnerRows).toBe(0);
  }, 120_000);
});
