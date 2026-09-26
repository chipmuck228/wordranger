import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { VocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import {
  VOCABULARY_CONTENT_FINGERPRINT_VERSION,
  buildVocabularySeedManifest,
  fingerprintVocabularyImportRows,
} from "@/server/vocabulary/import/rebuild-contract";
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

const VOCAB_TABLES = [
  "vocabulary_source_entries",
  "lexemes",
  "lexeme_relations",
  "lexeme_tags",
] as const;

const REQUIRED_TABLES = [...VOCAB_TABLES, ...LEARNER_TABLES] as const;

const TABLE_PRIVILEGES = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
] as const;

const SERVICE_ROLE_ALLOWED_VOCAB_PRIVILEGES = [
  "SELECT",
  "INSERT",
  "UPDATE",
] as const;

let db: PGlite;
let baselineSql: string;
let isolatedSql: string;
let preBaselineDefaultGrantMode:
  | "alter_default_privileges"
  | "explicit_create_time_grant" = "alter_default_privileges";
let preBaselineWitnessPrivileges: Record<
  (typeof TABLE_PRIVILEGES)[number],
  boolean
> | null = null;
let triggerProbeResult: "denied" | "unsupported" | "allowed" | null = null;
let referencesProbeResult: "denied" | "unsupported" | "allowed" | null = null;

function forIsolatedEngine(sql: string): string {
  return sql.replace(
    /create extension if not exists pgcrypto;\n\n/,
    "-- pgcrypto skipped on isolated PGlite; gen_random_uuid is built-in\n\n",
  );
}

function grantAllAfterVocabularyCreates(sql: string): string {
  let next = sql;
  for (const table of VOCAB_TABLES) {
    const marker = `create table public.${table} (`;
    const start = next.indexOf(marker);
    if (start < 0) {
      throw new Error(`Isolated SQL is missing ${marker}`);
    }
    const end = next.indexOf("\n);", start);
    if (end < 0) {
      throw new Error(`Isolated SQL has no terminator for ${table}`);
    }
    const insertAt = end + "\n);".length;
    next =
      next.slice(0, insertAt) +
      `\ngrant all on table public.${table} to service_role;` +
      next.slice(insertAt);
  }
  return next;
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

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error(`Expected boolean, got ${typeof value}`);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Expected finite number, got ${String(value)}`);
  }
  return number;
}

function asJson(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected text array");
  }
  return value.map((item) => String(item));
}

async function withRole<T>(role: string, run: () => Promise<T>): Promise<T> {
  await exec(`set role ${role}`);
  try {
    return await run();
  } finally {
    await exec("reset role");
  }
}

async function expectDenied(run: () => Promise<unknown>): Promise<void> {
  await expect(run()).rejects.toThrow(/permission denied/i);
}

async function hasTablePrivilege(
  role: string,
  table: string,
  privilege: (typeof TABLE_PRIVILEGES)[number],
): Promise<boolean> {
  const value = await scalar<boolean | string>(
    `select has_table_privilege($1, $2, $3)`,
    [role, `public.${table}`, privilege],
  );
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "t" || value === "true") {
    return true;
  }
  if (value === "f" || value === "false") {
    return false;
  }
  throw new Error(`Unexpected privilege result ${String(value)}`);
}

async function tablePrivilegeMap(
  role: string,
  table: string,
): Promise<Record<(typeof TABLE_PRIVILEGES)[number], boolean>> {
  const privileges = {} as Record<(typeof TABLE_PRIVILEGES)[number], boolean>;
  for (const privilege of TABLE_PRIVILEGES) {
    privileges[privilege] = await hasTablePrivilege(role, table, privilege);
  }
  return privileges;
}

async function publicGranteePrivilegeCount(table: string): Promise<number> {
  return scalar<number>(
    `select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     cross join lateral aclexplode(coalesce(c.relacl, '{}'::aclitem[])) e
     where n.nspname = 'public'
       and c.relname = $1
       and e.grantee = 0`,
    [table],
  );
}

async function observedImportRows(): Promise<VocabularyImportRows> {
  const sourceEntries = await query<Record<string, unknown>>(`
    select id, canonical_key, source_index, section, source_page_start,
           source_page_end, source_word_raw, starred, source_ipa_raw,
           source_pos_raw, source_meaning_raw, raw_entry, parse_status,
           parse_issues, source_review_note
    from public.vocabulary_source_entries
  `);
  const lexemes = await query<Record<string, unknown>>(`
    select id, canonical_key, source_entry_id, source_index, lemma, display,
           role, starred, parts_of_speech, ipa, meanings_zh, forms, variants,
           abbreviation_of_lexeme_id, quality_status, quality_issues,
           correction_applied, correction_note
    from public.lexemes
  `);
  const relations = await query<Record<string, unknown>>(`
    select id, canonical_key, type, from_lexeme_id, to_lexeme_id,
           is_symmetric, confidence, provenance, note
    from public.lexeme_relations
  `);
  const tags = await query<Record<string, unknown>>(`
    select lexeme_id, topics, semantic_categories, game_tags,
           topic_confidence, semantic_confidence, game_confidence
    from public.lexeme_tags
  `);
  return {
    sourceEntries: sourceEntries.map((row) => ({
      ...row,
      source_index: asNumber(row.source_index),
      source_page_start: asNumber(row.source_page_start),
      source_page_end: asNumber(row.source_page_end),
      starred: asBoolean(row.starred),
      parse_issues: asJson(row.parse_issues),
    })),
    lexemes: lexemes.map((row) => ({
      ...row,
      source_index: asNumber(row.source_index),
      starred: asBoolean(row.starred),
      parts_of_speech: asTextArray(row.parts_of_speech),
      ipa: asTextArray(row.ipa),
      meanings_zh: asJson(row.meanings_zh),
      forms: asTextArray(row.forms),
      variants: asTextArray(row.variants),
      quality_issues: asJson(row.quality_issues),
      correction_applied: asBoolean(row.correction_applied),
    })),
    lexemeAbbreviationUpdates: [],
    relations: relations.map((row) => ({
      ...row,
      is_symmetric: asBoolean(row.is_symmetric),
      confidence: asNumber(row.confidence),
    })),
    tags: tags.map((row) => ({
      ...row,
      topics: asTextArray(row.topics),
      semantic_categories: asTextArray(row.semantic_categories),
      game_tags: asTextArray(row.game_tags),
      topic_confidence: asNumber(row.topic_confidence),
      semantic_confidence: asNumber(row.semantic_confidence),
      game_confidence: asNumber(row.game_confidence),
    })),
  };
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
      grant anon to current_user;
      grant authenticated to current_user;
      grant service_role to current_user;
    `);

    let defaultPrivilegesApplied = false;
    try {
      await exec(`
        alter default privileges in schema public
          grant all on tables to service_role;
      `);
      defaultPrivilegesApplied = true;
    } catch {
      defaultPrivilegesApplied = false;
    }

    await exec(`
      create table public._pre_baseline_service_role_default_priv_witness (
        id int primary key
      );
    `);
    preBaselineWitnessPrivileges = await tablePrivilegeMap(
      "service_role",
      "_pre_baseline_service_role_default_priv_witness",
    );
    const defaultPrivilegesGrantedAll = TABLE_PRIVILEGES.every(
      (privilege) => preBaselineWitnessPrivileges?.[privilege] === true,
    );
    if (!defaultPrivilegesApplied || !defaultPrivilegesGrantedAll) {
      isolatedSql = grantAllAfterVocabularyCreates(isolatedSql);
      preBaselineDefaultGrantMode = "explicit_create_time_grant";
      await exec(`
        grant all on table public._pre_baseline_service_role_default_priv_witness
          to service_role;
      `);
      preBaselineWitnessPrivileges = await tablePrivilegeMap(
        "service_role",
        "_pre_baseline_service_role_default_priv_witness",
      );
    } else {
      preBaselineDefaultGrantMode = "alter_default_privileges";
    }
    await exec(
      `drop table public._pre_baseline_service_role_default_priv_witness;`,
    );

    expect(baselineSql).not.toMatch(/^begin;/m);
    expect(baselineSql).not.toMatch(/^commit;/m);
    // Test-owned wrapper only. Production SQL stays transaction-control-free.
    await exec(`begin;\n${isolatedSql}\ncommit;`);
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
    expect(
      await scalar<string>(
        `select tgname from pg_trigger where tgname = 'learning_evidence_no_update'`,
      ),
    ).toBe("learning_evidence_no_update");
    expect(
      await scalar<number>(
        `select count(*)::int from pg_proc where proname = 'cleanup_progress_test_user'`,
      ),
    ).toBe(0);
    expect(
      await scalar<boolean>(
        `select rolsuper from pg_roles where rolname = 'service_role'`,
      ),
    ).toBe(false);
  });

  it("simulates fresh Supabase service_role ALL before baseline clears it", async () => {
    expect(preBaselineDefaultGrantMode).toMatch(
      /alter_default_privileges|explicit_create_time_grant/,
    );
    expect(preBaselineWitnessPrivileges).not.toBeNull();
    for (const privilege of TABLE_PRIVILEGES) {
      expect(
        preBaselineWitnessPrivileges?.[privilege],
        `pre-baseline witness ${privilege}`,
      ).toBe(true);
    }
    if (preBaselineDefaultGrantMode === "explicit_create_time_grant") {
      for (const table of VOCAB_TABLES) {
        expect(isolatedSql).toContain(
          `grant all on table public.${table} to service_role;`,
        );
      }
    }
  });

  it("probes real SQL allow/deny for service_role, anon, and authenticated", async () => {
    for (const table of VOCAB_TABLES) {
      const serviceRole = await tablePrivilegeMap("service_role", table);
      for (const privilege of SERVICE_ROLE_ALLOWED_VOCAB_PRIVILEGES) {
        expect(serviceRole[privilege], `${table} ${privilege}`).toBe(true);
      }
      expect(serviceRole.DELETE, `${table} DELETE`).toBe(false);
      expect(serviceRole.TRUNCATE, `${table} TRUNCATE`).toBe(false);
      expect(serviceRole.REFERENCES, `${table} REFERENCES`).toBe(false);
      expect(serviceRole.TRIGGER, `${table} TRIGGER`).toBe(false);
      expect(await publicGranteePrivilegeCount(table), `${table} PUBLIC`).toBe(
        0,
      );
      for (const role of ["anon", "authenticated"] as const) {
        const privileges = await tablePrivilegeMap(role, table);
        for (const privilege of TABLE_PRIVILEGES) {
          expect(privileges[privilege], `${role} ${table} ${privilege}`).toBe(
            false,
          );
        }
      }
    }

    await withRole("service_role", async () => {
      expect(
        await scalar<number>(
          `select count(*)::int from public.vocabulary_source_entries`,
        ),
      ).toBe(0);
      await db.query(
        `insert into public.vocabulary_source_entries
          (id, canonical_key, source_index, source_word_raw, source_meaning_raw)
         values ($1, $2, $3, $4, $5)`,
        [
          "00000000-0000-4000-8000-0000000000aa",
          "src-perm-probe",
          -1,
          "probe",
          "",
        ],
      );
      await db.query(
        `update public.vocabulary_source_entries
         set source_word_raw = 'probe-updated'
         where canonical_key = 'src-perm-probe'`,
      );
      for (const table of VOCAB_TABLES) {
        await expectDenied(() =>
          db.query(`delete from public.${table} where false`),
        );
        await expectDenied(() => db.exec(`truncate public.${table}`));
      }
      for (const table of LEARNER_TABLES) {
        expect(
          await scalar<number>(`select count(*)::int from public.${table}`),
        ).toBe(0);
      }
      await db.query(`delete from public.game_sessions where false`);
    });

    await exec(`
      create function public.vocab_privilege_probe_noop()
      returns trigger
      language plpgsql
      as $$
      begin
        return NEW;
      end;
      $$;
      grant create on schema public to service_role;
    `);
    await withRole("service_role", async () => {
      try {
        await db.exec(`
          create table public._vocab_references_probe (
            lexeme_id uuid references public.lexemes (id)
          );
        `);
        referencesProbeResult = "allowed";
        await db.exec(`drop table public._vocab_references_probe;`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        referencesProbeResult = /permission denied/i.test(message)
          ? "denied"
          : "unsupported";
      }
      try {
        await db.exec(`
          create trigger vocab_privilege_probe
          after insert on public.lexemes
          for each row execute function public.vocab_privilege_probe_noop();
        `);
        triggerProbeResult = "allowed";
        await db.exec(`drop trigger vocab_privilege_probe on public.lexemes;`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        triggerProbeResult = /permission denied/i.test(message)
          ? "denied"
          : "unsupported";
      }
    });
    await exec(`revoke create on schema public from service_role;`);
    expect(referencesProbeResult).not.toBe("allowed");
    expect(triggerProbeResult).not.toBe("allowed");
    if (referencesProbeResult === "unsupported") {
      expect(
        await hasTablePrivilege("service_role", "lexemes", "REFERENCES"),
      ).toBe(false);
    } else {
      expect(referencesProbeResult).toBe("denied");
    }
    if (triggerProbeResult === "unsupported") {
      expect(await hasTablePrivilege("service_role", "lexemes", "TRIGGER")).toBe(
        false,
      );
    } else {
      expect(triggerProbeResult).toBe("denied");
    }

    await exec(`
      delete from public.vocabulary_source_entries
      where canonical_key = 'src-perm-probe';
    `);

    await withRole("anon", async () => {
      await expectDenied(() =>
        db.query(`select count(*) from public.lexemes`),
      );
      await expectDenied(() =>
        db.query(`select count(*) from public.learning_tasks`),
      );
    });
    await withRole("authenticated", async () => {
      await expectDenied(() =>
        db.query(`select count(*) from public.lexeme_tags`),
      );
      await expectDenied(() =>
        db.query(`select count(*) from public.game_sessions`),
      );
    });
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

  it("seeds bundled vocabulary and matches the shared content fingerprint", async () => {
    await exec(`
      truncate public.learning_evidence, public.lexemes, public.vocabulary_source_entries
      cascade;
    `);
    const dataset = loadVocabularyDataset();
    const expected = buildVocabularySeedManifest(dataset);
    expect(expected.algorithmVersion).toBe(VOCABULARY_CONTENT_FINGERPRINT_VERSION);
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

    const observedRows = await observedImportRows();
    const observed = fingerprintVocabularyImportRows(observedRows);
    expect(observedRows.sourceEntries).toHaveLength(expected.sourceEntries);
    expect(observedRows.lexemes).toHaveLength(expected.lexemes);
    expect(observedRows.relations).toHaveLength(expected.relations);
    expect(observedRows.tags).toHaveLength(expected.tags);
    expect(observed.algorithmVersion).toBe(expected.algorithmVersion);
    expect(observed.fingerprint).toBe(expected.fingerprint);

    const original = await scalar<unknown>(
      `select meanings_zh from public.lexemes order by canonical_key limit 1`,
    );
    await db.query(
      `update public.lexemes
       set meanings_zh = $1::jsonb
       where id = (select id from public.lexemes order by canonical_key limit 1)`,
      [JSON.stringify(["fingerprint-drift"])],
    );
    expect(
      fingerprintVocabularyImportRows(await observedImportRows()).fingerprint,
    ).not.toBe(expected.fingerprint);

    await db.query(
      `update public.lexemes
       set meanings_zh = $1::jsonb
       where id = (select id from public.lexemes order by canonical_key limit 1)`,
      [JSON.stringify(original)],
    );
    expect(
      fingerprintVocabularyImportRows(await observedImportRows()).fingerprint,
    ).toBe(expected.fingerprint);

    expect(
      await scalar<number>(
        `select (
           (select count(*) from public.learning_tasks) +
           (select count(*) from public.game_sessions) +
           (select count(*) from public.learning_evidence) +
           (select count(*) from public.student_lexeme_models)
         )::int`,
      ),
    ).toBe(0);
  }, 120_000);
});
