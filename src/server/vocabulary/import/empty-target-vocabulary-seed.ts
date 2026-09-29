import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { toVocabularyImportRows } from "./import-rows";
import type { VocabularyImportRows } from "./import-rows";
import {
  VOCABULARY_CONTENT_FINGERPRINT_VERSION,
  effectiveVocabularyImportRows,
  fingerprintVocabularyImportRows,
  type EffectiveVocabularyImportRows,
} from "./rebuild-contract";
import { loadVocabularyDataset } from "../load-vocabulary-dataset";

export const EMPTY_TARGET_SEED_GENERATOR_VERSION =
  "dedicated-vocabulary-empty-target-seed-v0" as const;
export const EMPTY_TARGET_SEED_RELATIVE_PATH =
  "supabase/seeds/dedicated_wordranger_vocabulary_v0.sql" as const;
export const REMOTE_EMPTY_TARGET_SEED_APPLY_NOT_AUTHORIZED =
  "REMOTE_EMPTY_TARGET_SEED_APPLY_NOT_AUTHORIZED" as const;

export const EXPECTED_VOCABULARY_CONTENT_FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";
export const EXPECTED_SOURCE_ENTRY_COUNT = 1600;
export const EXPECTED_LEXEME_COUNT = 1638;
export const EXPECTED_RELATION_COUNT = 716;
export const EXPECTED_TAG_COUNT = 1638;

export const VOCABULARY_SEED_TABLES = [
  "vocabulary_source_entries",
  "lexemes",
  "lexeme_relations",
  "lexeme_tags",
] as const;

export const LEARNER_ZERO_TABLES = [
  "learning_tasks",
  "game_sessions",
  "learning_evidence",
  "student_lexeme_models",
  "student_lexeme_skill_states",
  "student_lexeme_weaknesses",
] as const;

const REPOSITORY_CONTENT_FILES = [
  "data/vocabulary/source/words-source.json",
  "data/vocabulary/canonical/words-canonical.json",
  "data/vocabulary/enrichment/word-relations.json",
  "data/vocabulary/enrichment/word-tags.json",
] as const;

const SOURCE_ENTRY_COLUMNS = [
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

const LEXEME_COLUMNS = [
  "id",
  "canonical_key",
  "source_entry_id",
  "source_index",
  "lemma",
  "display",
  "role",
  "starred",
  "parts_of_speech",
  "ipa",
  "meanings_zh",
  "forms",
  "variants",
  "abbreviation_of_lexeme_id",
  "quality_status",
  "quality_issues",
  "correction_applied",
  "correction_note",
] as const;

const RELATION_COLUMNS = [
  "id",
  "canonical_key",
  "type",
  "from_lexeme_id",
  "to_lexeme_id",
  "is_symmetric",
  "confidence",
  "provenance",
  "note",
] as const;

const TAG_COLUMNS = [
  "lexeme_id",
  "topics",
  "semantic_categories",
  "game_tags",
  "topic_confidence",
  "semantic_confidence",
  "game_confidence",
] as const;

const REQUIRED_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ...SOURCE_ENTRY_COLUMNS.map((column) => ["vocabulary_source_entries", column] as const),
  ...LEXEME_COLUMNS.map((column) => ["lexemes", column] as const),
  ...RELATION_COLUMNS.map((column) => ["lexeme_relations", column] as const),
  ...TAG_COLUMNS.map((column) => ["lexeme_tags", column] as const),
];

const JSONB_COLUMNS = new Set([
  "parse_issues",
  "meanings_zh",
  "quality_issues",
]);

const TEXT_ARRAY_COLUMNS = new Set([
  "parts_of_speech",
  "ipa",
  "forms",
  "variants",
  "topics",
  "semantic_categories",
  "game_tags",
]);

export interface DedicatedVocabularySeedArtifact {
  sql: string;
  fingerprintVersion: typeof VOCABULARY_CONTENT_FINGERPRINT_VERSION;
  fingerprint: string;
  sourceEntries: number;
  lexemes: number;
  relations: number;
  tags: number;
  abbreviationCount: number;
  abbreviationDigest: string;
  repositoryContentSha256: string;
  seedSha256: string;
}

export interface DedicatedVocabularySeedCliResult {
  code:
    | "DEDICATED_VOCABULARY_SEED_GENERATED"
    | "DEDICATED_VOCABULARY_SEED_CHECK_OK"
    | "DEDICATED_VOCABULARY_SEED_DRIFT"
    | "DEDICATED_VOCABULARY_SEED_USAGE";
  exitCode: number;
  fingerprintVersion: typeof VOCABULARY_CONTENT_FINGERPRINT_VERSION;
  fingerprint: string;
  sourceEntries: number;
  lexemes: number;
  relations: number;
  tags: number;
  seedSha256: string;
}

function sha256Bytes(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function repositoryVocabularyContentSha256(
  repoRoot = process.cwd(),
): string {
  const hash = createHash("sha256");
  for (const relative of REPOSITORY_CONTENT_FILES) {
    hash.update(relative);
    hash.update("\0");
    hash.update(readFileSync(path.join(repoRoot, relative)));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlLiteral(column: string, value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("EMPTY_TARGET_SEED_NON_FINITE_NUMBER");
    }
    return String(value);
  }
  if (JSONB_COLUMNS.has(column)) {
    return `${sqlString(JSON.stringify(value))}::jsonb`;
  }
  if (TEXT_ARRAY_COLUMNS.has(column)) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new Error("EMPTY_TARGET_SEED_TEXT_ARRAY_INVALID");
    }
    if (value.length === 0) {
      return "ARRAY[]::text[]";
    }
    return `ARRAY[${value.map((item) => sqlString(item)).join(", ")}]::text[]`;
  }
  if (typeof value === "string") {
    return sqlString(value);
  }
  throw new Error("EMPTY_TARGET_SEED_UNSUPPORTED_LITERAL");
}

function sqlInsert(
  table: string,
  columns: readonly string[],
  rows: Record<string, unknown>[],
): string {
  const header = `insert into public.${table} (\n  ${columns.join(",\n  ")}\n) values`;
  const values = rows
    .map((row) => {
      const cells = columns.map((column) => sqlLiteral(column, row[column]));
      return `  (${cells.join(", ")})`;
    })
    .join(",\n");
  return `${header}\n${values};`;
}

function requiredColumnSql(): string {
  const tuples = REQUIRED_COLUMNS.map(
    ([table, column]) => `    ('${table}', '${column}')`,
  ).join(",\n");
  return tuples;
}

function zeroCountSql(tables: readonly string[]): string {
  return tables
    .map((table) => `(select count(*) from public.${table})`)
    .join("\n     + ");
}

function abbreviationDigest(lexemes: Record<string, unknown>[]): string {
  const payload = lexemes
    .map((row) => {
      const id = String(row.id ?? "");
      const abbreviation =
        row.abbreviation_of_lexeme_id === null ||
        row.abbreviation_of_lexeme_id === undefined
          ? ""
          : String(row.abbreviation_of_lexeme_id);
      return `${id}:${abbreviation}`;
    })
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .join(",");
  return sha256Bytes(payload);
}

function buildGuards(input: {
  abbreviationCount: number;
  abbreviationDigest: string;
}): { precondition: string; postcondition: string } {
  const vocabZero = zeroCountSql(VOCABULARY_SEED_TABLES);
  const learnerZero = zeroCountSql(LEARNER_ZERO_TABLES);
  const precondition = `do $seed_precondition$
declare
  missing_columns text;
begin
  if to_regclass('public.vocabulary_source_entries') is null
     or to_regclass('public.lexemes') is null
     or to_regclass('public.lexeme_relations') is null
     or to_regclass('public.lexeme_tags') is null
     or to_regclass('public.learning_tasks') is null
     or to_regclass('public.game_sessions') is null
     or to_regclass('public.learning_evidence') is null
     or to_regclass('public.student_lexeme_models') is null
     or to_regclass('public.student_lexeme_skill_states') is null
     or to_regclass('public.student_lexeme_weaknesses') is null
  then
    raise exception 'EMPTY_TARGET_SEED_PRECONDITION_FAILED';
  end if;

  select string_agg(required.table_name || '.' || required.column_name, ',')
    into missing_columns
  from (
    values
${requiredColumnSql()}
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns as columns
    where columns.table_schema = 'public'
      and columns.table_name = required.table_name
      and columns.column_name = required.column_name
  );
  if missing_columns is not null then
    raise exception 'EMPTY_TARGET_SEED_PRECONDITION_FAILED';
  end if;

  if ${vocabZero} <> 0 then
    raise exception 'EMPTY_TARGET_SEED_PRECONDITION_FAILED';
  end if;

  if ${learnerZero} <> 0 then
    raise exception 'EMPTY_TARGET_SEED_PRECONDITION_FAILED';
  end if;
end
$seed_precondition$;`;

  const postcondition = `do $seed_postcondition$
declare
  abbreviation_digest text;
begin
  if (select count(*) from public.vocabulary_source_entries) <> ${EXPECTED_SOURCE_ENTRY_COUNT}
     or (select count(*) from public.lexemes) <> ${EXPECTED_LEXEME_COUNT}
     or (select count(*) from public.lexeme_relations) <> ${EXPECTED_RELATION_COUNT}
     or (select count(*) from public.lexeme_tags) <> ${EXPECTED_TAG_COUNT}
  then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if ${learnerZero} <> 0 then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if exists (
    select 1
    from public.lexemes as lexemes
    where not exists (
      select 1
      from public.vocabulary_source_entries as source_entries
      where source_entries.id = lexemes.source_entry_id
    )
  ) then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if exists (
    select 1
    from public.lexeme_relations as relations
    where not exists (
      select 1 from public.lexemes as lexemes where lexemes.id = relations.from_lexeme_id
    )
       or not exists (
      select 1 from public.lexemes as lexemes where lexemes.id = relations.to_lexeme_id
    )
  ) then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if exists (
    select 1
    from public.lexeme_tags as tags
    where not exists (
      select 1 from public.lexemes as lexemes where lexemes.id = tags.lexeme_id
    )
  ) then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if exists (
    select 1
    from public.lexemes
    where abbreviation_of_lexeme_id is not null
      and not exists (
        select 1
        from public.lexemes as targets
        where targets.id = lexemes.abbreviation_of_lexeme_id
      )
  ) then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if exists (
    select 1 from public.vocabulary_source_entries
    where canonical_key = ''
       or source_word_raw = ''
  ) then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if exists (
    select 1 from public.lexemes
    where canonical_key = ''
       or lemma = ''
       or display = ''
       or role = ''
       or quality_status = ''
  ) then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if exists (
    select 1 from public.lexeme_relations
    where type = ''
       or provenance = ''
  ) then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  if (select count(*) from public.lexemes where abbreviation_of_lexeme_id is not null)
       <> ${input.abbreviationCount}
  then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;

  select encode(digest(coalesce((
    select string_agg(
      id::text || ':' || coalesce(abbreviation_of_lexeme_id::text, ''),
      ','
      order by id::text
    )
    from public.lexemes
  ), ''), 'sha256'), 'hex')
    into abbreviation_digest;
  if abbreviation_digest is distinct from '${input.abbreviationDigest}' then
    raise exception 'EMPTY_TARGET_SEED_POSTCONDITION_FAILED';
  end if;
end
$seed_postcondition$;`;

  return { precondition, postcondition };
}

export function loadEffectiveVocabularySeedRows(): {
  rows: EffectiveVocabularyImportRows;
  fingerprint: string;
  abbreviationCount: number;
  abbreviationDigest: string;
  repositoryContentSha256: string;
} {
  const dataset = loadVocabularyDataset();
  const mapped = toVocabularyImportRows(dataset);
  const effective = effectiveVocabularyImportRows(mapped);
  const printed = fingerprintVocabularyImportRows(mapped);
  if (
    printed.algorithmVersion !== VOCABULARY_CONTENT_FINGERPRINT_VERSION ||
    printed.fingerprint !== EXPECTED_VOCABULARY_CONTENT_FINGERPRINT ||
    effective.sourceEntries.length !== EXPECTED_SOURCE_ENTRY_COUNT ||
    effective.lexemes.length !== EXPECTED_LEXEME_COUNT ||
    effective.relations.length !== EXPECTED_RELATION_COUNT ||
    effective.tags.length !== EXPECTED_TAG_COUNT
  ) {
    throw new Error("EMPTY_TARGET_SEED_CONTRACT_DRIFT");
  }
  return {
    rows: effective,
    fingerprint: printed.fingerprint,
    abbreviationCount: effective.lexemes.filter(
      (row) => row.abbreviation_of_lexeme_id,
    ).length,
    abbreviationDigest: abbreviationDigest(effective.lexemes),
    repositoryContentSha256: repositoryVocabularyContentSha256(),
  };
}

export function generateDedicatedVocabularySeedSql(): DedicatedVocabularySeedArtifact {
  const loaded = loadEffectiveVocabularySeedRows();
  const { precondition, postcondition } = buildGuards({
    abbreviationCount: loaded.abbreviationCount,
    abbreviationDigest: loaded.abbreviationDigest,
  });
  const sql = [
    "-- Dedicated WordRanger empty-target vocabulary seed V0.",
    "-- Candidate / Not a Standard.",
    `-- Generator version: ${EMPTY_TARGET_SEED_GENERATOR_VERSION}`,
    `-- Source content fingerprint version: ${VOCABULARY_CONTENT_FINGERPRINT_VERSION}`,
    `-- Source content fingerprint: ${loaded.fingerprint}`,
    `-- Repository content SHA-256: ${loaded.repositoryContentSha256}`,
    `-- Expected counts: source_entries=${EXPECTED_SOURCE_ENTRY_COUNT} lexemes=${EXPECTED_LEXEME_COUNT} relations=${EXPECTED_RELATION_COUNT} tags=${EXPECTED_TAG_COUNT}`,
    "-- Empty-target only. Not a migration. Not learner data.",
    `-- ${REMOTE_EMPTY_TARGET_SEED_APPLY_NOT_AUTHORIZED}`,
    "-- Generated file digest is not written into this file.",
    "",
    "begin;",
    "set local role service_role;",
    "",
    precondition,
    "",
    sqlInsert(
      "vocabulary_source_entries",
      SOURCE_ENTRY_COLUMNS,
      loaded.rows.sourceEntries,
    ),
    "",
    sqlInsert("lexemes", LEXEME_COLUMNS, loaded.rows.lexemes),
    "",
    sqlInsert("lexeme_relations", RELATION_COLUMNS, loaded.rows.relations),
    "",
    sqlInsert("lexeme_tags", TAG_COLUMNS, loaded.rows.tags),
    "",
    postcondition,
    "",
    "commit;",
    "",
  ].join("\n");
  return {
    sql,
    fingerprintVersion: VOCABULARY_CONTENT_FINGERPRINT_VERSION,
    fingerprint: loaded.fingerprint,
    sourceEntries: loaded.rows.sourceEntries.length,
    lexemes: loaded.rows.lexemes.length,
    relations: loaded.rows.relations.length,
    tags: loaded.rows.tags.length,
    abbreviationCount: loaded.abbreviationCount,
    abbreviationDigest: loaded.abbreviationDigest,
    repositoryContentSha256: loaded.repositoryContentSha256,
    seedSha256: sha256Bytes(sql),
  };
}

export function committedSeedPath(repoRoot = process.cwd()): string {
  return path.join(repoRoot, EMPTY_TARGET_SEED_RELATIVE_PATH);
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error("EMPTY_TARGET_SEED_BOOLEAN_COERCE_FAILED");
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("EMPTY_TARGET_SEED_NUMBER_COERCE_FAILED");
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
    throw new Error("EMPTY_TARGET_SEED_TEXT_ARRAY_COERCE_FAILED");
  }
  return value.map((item) => String(item));
}

export function observedVocabularyImportRowsFromDatabase(input: {
  sourceEntries: Record<string, unknown>[];
  lexemes: Record<string, unknown>[];
  relations: Record<string, unknown>[];
  tags: Record<string, unknown>[];
}): VocabularyImportRows {
  return {
    sourceEntries: input.sourceEntries.map((row) => ({
      ...row,
      source_index: asNumber(row.source_index),
      source_page_start: asNumber(row.source_page_start),
      source_page_end: asNumber(row.source_page_end),
      starred: asBoolean(row.starred),
      parse_issues: asJson(row.parse_issues),
    })),
    lexemes: input.lexemes.map((row) => ({
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
    relations: input.relations.map((row) => ({
      ...row,
      is_symmetric: asBoolean(row.is_symmetric),
      confidence: asNumber(row.confidence),
    })),
    tags: input.tags.map((row) => ({
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

export const OBSERVED_VOCABULARY_JSON_SQL = `select json_build_object(
  'sourceEntries', coalesce((
    select json_agg(row_to_json(source_entries) order by source_entries.id::text)
    from (
      select id, canonical_key, source_index, section, source_page_start,
             source_page_end, source_word_raw, starred, source_ipa_raw,
             source_pos_raw, source_meaning_raw, raw_entry, parse_status,
             parse_issues, source_review_note
      from public.vocabulary_source_entries
    ) as source_entries
  ), '[]'::json),
  'lexemes', coalesce((
    select json_agg(row_to_json(lexemes) order by lexemes.id::text)
    from (
      select id, canonical_key, source_entry_id, source_index, lemma, display,
             role, starred, parts_of_speech, ipa, meanings_zh, forms, variants,
             abbreviation_of_lexeme_id, quality_status, quality_issues,
             correction_applied, correction_note
      from public.lexemes
    ) as lexemes
  ), '[]'::json),
  'relations', coalesce((
    select json_agg(row_to_json(relations) order by relations.id::text)
    from (
      select id, canonical_key, type, from_lexeme_id, to_lexeme_id,
             is_symmetric, confidence, provenance, note
      from public.lexeme_relations
    ) as relations
  ), '[]'::json),
  'tags', coalesce((
    select json_agg(row_to_json(tags) order by tags.lexeme_id::text)
    from (
      select lexeme_id, topics, semantic_categories, game_tags,
             topic_confidence, semantic_confidence, game_confidence
      from public.lexeme_tags
    ) as tags
  ), '[]'::json)
)::text;`;

export function parseSeedCliArgs(
  argv: readonly string[],
): "check" | "write" | "usage" {
  const flags = argv.filter((value) => value.startsWith("--"));
  if (flags.length === 1 && flags[0] === "--check") {
    return "check";
  }
  if (flags.length === 1 && flags[0] === "--write") {
    return "write";
  }
  return "usage";
}

export function runDedicatedVocabularySeedCli(
  argv: readonly string[],
  io: { log: (value: string) => void; error: (value: string) => void } = {
    log: (value) => {
      console.log(value);
    },
    error: (value) => {
      console.error(value);
    },
  },
  repoRoot = process.cwd(),
): DedicatedVocabularySeedCliResult {
  const mode = parseSeedCliArgs(argv);
  if (mode === "usage") {
    const result: DedicatedVocabularySeedCliResult = {
      code: "DEDICATED_VOCABULARY_SEED_USAGE",
      exitCode: 1,
      fingerprintVersion: VOCABULARY_CONTENT_FINGERPRINT_VERSION,
      fingerprint: "",
      sourceEntries: 0,
      lexemes: 0,
      relations: 0,
      tags: 0,
      seedSha256: "",
    };
    io.error("usage: generate-dedicated-vocabulary-seed --check|--write");
    return result;
  }
  const artifact = generateDedicatedVocabularySeedSql();
  const summary = {
    fingerprintVersion: artifact.fingerprintVersion,
    fingerprint: artifact.fingerprint,
    sourceEntries: artifact.sourceEntries,
    lexemes: artifact.lexemes,
    relations: artifact.relations,
    tags: artifact.tags,
    seedSha256: artifact.seedSha256,
  };
  if (mode === "write") {
    writeFileSync(committedSeedPath(repoRoot), artifact.sql);
    const result: DedicatedVocabularySeedCliResult = {
      code: "DEDICATED_VOCABULARY_SEED_GENERATED",
      exitCode: 0,
      ...summary,
    };
    io.log(JSON.stringify(result, null, 2));
    return result;
  }
  const committed = readFileSync(committedSeedPath(repoRoot), "utf8");
  const matches = committed === artifact.sql;
  const result: DedicatedVocabularySeedCliResult = {
    code: matches
      ? "DEDICATED_VOCABULARY_SEED_CHECK_OK"
      : "DEDICATED_VOCABULARY_SEED_DRIFT",
    exitCode: matches ? 0 : 1,
    ...summary,
  };
  if (matches) {
    io.log(JSON.stringify(result, null, 2));
  } else {
    io.error(JSON.stringify(result, null, 2));
  }
  return result;
}
