/**
 * Dedicated vocabulary transactional direct-Postgres import candidate.
 * Local proof may run against disposable PostgreSQL 16.
 * Remote execution stays refused until a later independent
 * authorization changes this module.
 */

import { Buffer } from "node:buffer";
import type { VocabularyImportRows } from "./import-rows";

export const POSTGREST_IMPORT_PATH_SUSPENDED =
  "POSTGREST_IMPORT_PATH_SUSPENDED" as const;
export const THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED =
  "THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED" as const;
export const REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED =
  "REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED" as const;
export const HISTORY_WRITE_REJECTED = "HISTORY_WRITE_REJECTED" as const;
export const SCHEMA_CHANGE_REJECTED = "SCHEMA_CHANGE_REJECTED" as const;
export const STALE_ROW_DELETE_REJECTED = "STALE_ROW_DELETE_REJECTED" as const;
export const SET_LOCAL_ROLE_REQUIRED = "SET LOCAL ROLE service_role" as const;

export const VOCABULARY_TABLES = [
  "vocabulary_source_entries",
  "lexemes",
  "lexeme_relations",
  "lexeme_tags",
] as const;

export const LEARNER_TABLES = [
  "learning_tasks",
  "game_sessions",
  "learning_evidence",
  "student_lexeme_models",
  "student_lexeme_skill_states",
  "student_lexeme_weaknesses",
] as const;

export const SOURCE_ENTRY_COLUMNS = [
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

export const LEXEME_COLUMNS = [
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

export const RELATION_COLUMNS = [
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

export const TAG_COLUMNS = [
  "lexeme_id",
  "topics",
  "semantic_categories",
  "game_tags",
  "topic_confidence",
  "semantic_confidence",
  "game_confidence",
] as const;

export const SOURCE_ENTRY_RECORD_TYPES = [
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

export const LEXEME_RECORD_TYPES = [
  "id uuid",
  "canonical_key text",
  "source_entry_id uuid",
  "source_index integer",
  "lemma text",
  "display text",
  "role text",
  "starred boolean",
  "parts_of_speech text[]",
  "ipa text[]",
  "meanings_zh jsonb",
  "forms text[]",
  "variants text[]",
  "abbreviation_of_lexeme_id uuid",
  "quality_status text",
  "quality_issues jsonb",
  "correction_applied boolean",
  "correction_note text",
].join(", ");

export const RELATION_RECORD_TYPES = [
  "id uuid",
  "canonical_key text",
  "type text",
  "from_lexeme_id uuid",
  "to_lexeme_id uuid",
  "is_symmetric boolean",
  "confidence numeric",
  "provenance text",
  "note text",
].join(", ");

export const TAG_RECORD_TYPES = [
  "lexeme_id uuid",
  "topics text[]",
  "semantic_categories text[]",
  "game_tags text[]",
  "topic_confidence numeric",
  "semantic_confidence numeric",
  "game_confidence numeric",
].join(", ");

export interface TransactionalImportAuthorization {
  remote: typeof REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED;
  postgrest: typeof POSTGREST_IMPORT_PATH_SUSPENDED;
  thirdImport: typeof THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED;
  historyWrite: typeof HISTORY_WRITE_REJECTED;
  schemaChange: typeof SCHEMA_CHANGE_REJECTED;
  staleDelete: typeof STALE_ROW_DELETE_REJECTED;
}

export function currentTransactionalImportAuthorization(): TransactionalImportAuthorization {
  return {
    remote: REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED,
    postgrest: POSTGREST_IMPORT_PATH_SUSPENDED,
    thirdImport: THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED,
    historyWrite: HISTORY_WRITE_REJECTED,
    schemaChange: SCHEMA_CHANGE_REJECTED,
    staleDelete: STALE_ROW_DELETE_REJECTED,
  };
}

export function refuseRemoteTransactionalImport(): typeof REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED {
  return REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED;
}

export function jsonCastFromUtf8(value: unknown): string {
  const json = JSON.stringify(value);
  const hex = Buffer.from(json, "utf8").toString("hex");
  if (hex.length === 0 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error("JSON_HEX_ENCODE_FAILED");
  }
  return `cast(convert_from(decode('${hex}', 'hex'), 'utf8') as json)`;
}

export function upsertFromJsonSql(
  table: string,
  columns: readonly string[],
  recordTypes: string,
  conflictKey: string,
  jsonExpr: string,
): string {
  if (table.includes(".") || columns.some((column) => !/^[a-z_]+$/.test(column))) {
    throw new Error("UNSAFE_IDENTIFIER");
  }
  const updateSet = columns
    .filter((column) => column !== conflictKey)
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");
  return [
    `insert into public.${table} (${columns.join(", ")})`,
    `select * from json_to_recordset(${jsonExpr}) as x(${recordTypes})`,
    `on conflict (${conflictKey}) do update set ${updateSet}`,
  ].join("\n");
}

export function abbreviationUpdateSql(jsonExpr: string): string {
  return [
    "update public.lexemes as target",
    "set abbreviation_of_lexeme_id = source.abbreviation_of_lexeme_id",
    "from json_to_recordset(",
    jsonExpr,
    ") as source(id uuid, abbreviation_of_lexeme_id uuid)",
    "where target.id = source.id",
  ].join("\n");
}

export function plannedTransactionPrefix(): string {
  return ["begin", "set local role service_role"].join(";\n") + ";";
}

export function plannedPrivilegeProbeSql(): string {
  return `
select session_user as login_role,
  current_user as role_name,
  has_table_privilege('service_role', 'public.vocabulary_source_entries', 'SELECT')
  and has_table_privilege('service_role', 'public.vocabulary_source_entries', 'INSERT')
  and has_table_privilege('service_role', 'public.vocabulary_source_entries', 'UPDATE')
  and not has_table_privilege('service_role', 'public.vocabulary_source_entries', 'DELETE')
  as source_entries_sui_no_delete
`.trim();
}

export function plannedCountAndLearnerGuardSql(expected: {
  sourceEntries: number;
  lexemes: number;
  relations: number;
  tags: number;
}): string {
  return `
do $guard$
declare
  source_count integer;
  lexeme_count integer;
  relation_count integer;
  tag_count integer;
  learner_count integer;
begin
  if current_user <> 'service_role' then
    raise exception 'ROLE_CONTRACT_MISMATCH';
  end if;
  select count(*) into source_count from public.vocabulary_source_entries;
  select count(*) into lexeme_count from public.lexemes;
  select count(*) into relation_count from public.lexeme_relations;
  select count(*) into tag_count from public.lexeme_tags;
  select (
    (select count(*) from public.learning_tasks) +
    (select count(*) from public.game_sessions) +
    (select count(*) from public.learning_evidence) +
    (select count(*) from public.student_lexeme_models) +
    (select count(*) from public.student_lexeme_skill_states) +
    (select count(*) from public.student_lexeme_weaknesses)
  ) into learner_count;
  if source_count <> ${expected.sourceEntries}
    or lexeme_count <> ${expected.lexemes}
    or relation_count <> ${expected.relations}
    or tag_count <> ${expected.tags} then
    raise exception 'PRECOMMIT_COUNT_MISMATCH';
  end if;
  if learner_count <> 0 then
    raise exception 'LEARNER_TABLES_NOT_ZERO';
  end if;
end
$guard$;
`.trim();
}

export function plannedReadbackSql(): string {
  return `
select json_build_object(
  'sourceEntries', (
    select coalesce(json_agg(row_to_json(s) order by cast(s.id as text)), cast('[]' as json))
    from (
      select ${SOURCE_ENTRY_COLUMNS.join(", ")}
      from public.vocabulary_source_entries
    ) s
  ),
  'lexemes', (
    select coalesce(json_agg(row_to_json(l) order by cast(l.id as text)), cast('[]' as json))
    from (
      select ${LEXEME_COLUMNS.join(", ")}
      from public.lexemes
    ) l
  ),
  'relations', (
    select coalesce(json_agg(row_to_json(r) order by cast(r.id as text)), cast('[]' as json))
    from (
      select ${RELATION_COLUMNS.join(", ")}
      from public.lexeme_relations
    ) r
  ),
  'tags', (
    select coalesce(json_agg(row_to_json(t) order by cast(t.lexeme_id as text)), cast('[]' as json))
    from (
      select ${TAG_COLUMNS.join(", ")}
      from public.lexeme_tags
    ) t
  )
)
`.trim();
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new Error("EXPECTED_BOOLEAN");
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error("EXPECTED_FINITE_NUMBER");
  return number;
}

function asJson(value: unknown): unknown {
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("EXPECTED_TEXT_ARRAY");
  return value.map((item) => String(item));
}

export function normalizeObservedVocabularyRows(input: {
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

export const COMMIT_CONFIRMED = "COMMIT_CONFIRMED" as const;
export const COMMIT_OUTCOME_UNKNOWN = "COMMIT_OUTCOME_UNKNOWN" as const;
export const COMMIT_RECONCILED_COMPLETE =
  "COMMIT_RECONCILED_COMPLETE" as const;
export const COMMIT_RECONCILED_ROLLED_BACK =
  "COMMIT_RECONCILED_ROLLED_BACK" as const;
export const COMMIT_RECONCILIATION_FAILED =
  "COMMIT_RECONCILIATION_FAILED" as const;
export const POOLED_TRANSACTION_QUERY_REJECTED =
  "POOLED_TRANSACTION_QUERY_REJECTED" as const;
export const PROMISE_ALL_IN_TRANSACTION_REJECTED =
  "PROMISE_ALL_IN_TRANSACTION_REJECTED" as const;
export const TRANSACTION_CONNECTION_MISMATCH =
  "TRANSACTION_CONNECTION_MISMATCH" as const;
export const REMOTE_TLS_REJECTED = "REMOTE_TLS_REJECTED" as const;
export const REMOTE_TLS_VERIFIED = "REMOTE_TLS_VERIFIED" as const;
export const CREDENTIAL_SOURCE_REJECTED = "CREDENTIAL_SOURCE_REJECTED" as const;
export const RETRY_AFTER_UNKNOWN_COMMIT_REJECTED =
  "RETRY_AFTER_UNKNOWN_COMMIT_REJECTED" as const;
export const RESEND_COMMIT_REJECTED = "RESEND_COMMIT_REJECTED" as const;

export const EXPECTED_SOURCE_ENTRIES = 1600;
export const EXPECTED_LEXEMES = 1638;
export const EXPECTED_RELATIONS = 716;
export const EXPECTED_TAGS = 1638;
export const EXPECTED_FINGERPRINT_VERSION = "vocabulary-content-v1" as const;
export const EXPECTED_CONTENT_FINGERPRINT =
  "9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb";

export const TRANSACTION_STEPS = [
  "acquire_one_dedicated_connection",
  "begin",
  "set_local_role_service_role",
  "verify_current_user_service_role",
  "verify_vocabulary_initial_state",
  "verify_learner_tables_zero",
  "upsert_vocabulary_source_entries",
  "upsert_lexemes",
  "update_lexeme_abbreviations",
  "upsert_lexeme_relations",
  "upsert_lexeme_tags",
  "readback_counts_same_connection",
  "readback_fingerprint_same_connection",
  "verify_learner_tables_zero_again",
  "commit_or_rollback",
] as const;

export const FORBIDDEN_TLS_MARKERS = [
  "sslmode=disable",
  "rejectUnauthorized: false",
  "NODE_TLS_REJECT_UNAUTHORIZED=0",
  "curl -k",
] as const;

export const FORBIDDEN_CREDENTIAL_SOURCES = [
  ".env.local",
  "ambient Supabase/Postgres/Vercel variables",
  "legacy CLI --linked",
  "compose REST URL into DB URL",
] as const;

export type CommitAck = "ok" | "transport_error";
export type CommitOutcome =
  | typeof COMMIT_CONFIRMED
  | typeof COMMIT_OUTCOME_UNKNOWN;
export type ReconciliationClass =
  | typeof COMMIT_RECONCILED_COMPLETE
  | typeof COMMIT_RECONCILED_ROLLED_BACK
  | typeof COMMIT_RECONCILIATION_FAILED;

export interface ReconciliationObservation {
  sourceEntries: number;
  lexemes: number;
  relations: number;
  tags: number;
  fingerprintVersion: string;
  fingerprint: string;
  learner: number;
  readable?: boolean;
  identityMatch?: boolean;
}

export function classifyCommitAck(ack: CommitAck): CommitOutcome {
  return ack === "ok" ? COMMIT_CONFIRMED : COMMIT_OUTCOME_UNKNOWN;
}

export function classifyReconciliation(
  observed: ReconciliationObservation,
): ReconciliationClass {
  if (observed.readable === false || observed.identityMatch === false) {
    return COMMIT_RECONCILIATION_FAILED;
  }
  const complete =
    observed.sourceEntries === EXPECTED_SOURCE_ENTRIES &&
    observed.lexemes === EXPECTED_LEXEMES &&
    observed.relations === EXPECTED_RELATIONS &&
    observed.tags === EXPECTED_TAGS &&
    observed.fingerprintVersion === EXPECTED_FINGERPRINT_VERSION &&
    observed.fingerprint === EXPECTED_CONTENT_FINGERPRINT &&
    observed.learner === 0;
  if (complete) return COMMIT_RECONCILED_COMPLETE;
  const rolledBack =
    observed.sourceEntries === 0 &&
    observed.lexemes === 0 &&
    observed.relations === 0 &&
    observed.tags === 0 &&
    observed.learner === 0;
  if (rolledBack) return COMMIT_RECONCILED_ROLLED_BACK;
  return COMMIT_RECONCILIATION_FAILED;
}

export function refuseRetryAfterUnknownCommit(): typeof RETRY_AFTER_UNKNOWN_COMMIT_REJECTED {
  return RETRY_AFTER_UNKNOWN_COMMIT_REJECTED;
}

export function refuseResendCommit(): typeof RESEND_COMMIT_REJECTED {
  return RESEND_COMMIT_REJECTED;
}

export function actionsAfterUnknownCommit(): {
  retryImport: false;
  resendCommit: false;
  deleteRows: false;
  truncate: false;
  repair: false;
  postgrestImport: false;
  startTrain: false;
  reconcileReadonly: true;
  requireNewConnection: true;
} {
  return {
    retryImport: false,
    resendCommit: false,
    deleteRows: false,
    truncate: false,
    repair: false,
    postgrestImport: false,
    startTrain: false,
    reconcileReadonly: true,
    requireNewConnection: true,
  };
}

export function actionsAfterReconciliationFailed(): {
  stop: true;
  retryImport: false;
  deleteRows: false;
  repair: false;
  postgrestImport: false;
  startTrain: false;
} {
  return {
    stop: true,
    retryImport: false,
    deleteRows: false,
    repair: false,
    postgrestImport: false,
    startTrain: false,
  };
}

export function assertSameTransactionConnection(
  expected: string,
  actual: string,
): void {
  if (!expected || expected !== actual) {
    throw new Error(TRANSACTION_CONNECTION_MISMATCH);
  }
}

export function refusePooledTransactionQuery(): typeof POOLED_TRANSACTION_QUERY_REJECTED {
  return POOLED_TRANSACTION_QUERY_REJECTED;
}

export function refusePromiseAllInTransaction(): typeof PROMISE_ALL_IN_TRANSACTION_REJECTED {
  return PROMISE_ALL_IN_TRANSACTION_REJECTED;
}

export function classifyRemoteTls(input: {
  sslmode?: string;
  rejectUnauthorized?: boolean;
  nodeTlsRejectUnauthorized?: string;
  curlInsecure?: boolean;
}): typeof REMOTE_TLS_VERIFIED | typeof REMOTE_TLS_REJECTED {
  if (
    input.sslmode === "disable" ||
    input.rejectUnauthorized === false ||
    input.nodeTlsRejectUnauthorized === "0" ||
    input.curlInsecure === true
  ) {
    return REMOTE_TLS_REJECTED;
  }
  if (input.sslmode === "verify-full" && input.rejectUnauthorized === true) {
    return REMOTE_TLS_VERIFIED;
  }
  return REMOTE_TLS_REJECTED;
}

export function classifyCredentialSource(input: {
  vercelProductionSnapshot: boolean;
  envLocal: boolean;
  ambient: boolean;
  linked: boolean;
  composedFromRest: boolean;
}): "DEDICATED_SNAPSHOT_ELIGIBLE" | typeof CREDENTIAL_SOURCE_REJECTED {
  if (
    !input.vercelProductionSnapshot ||
    input.envLocal ||
    input.ambient ||
    input.linked ||
    input.composedFromRest
  ) {
    return CREDENTIAL_SOURCE_REJECTED;
  }
  return "DEDICATED_SNAPSHOT_ELIGIBLE";
}

export function classifyDedicatedTarget(input: {
  apiDedicated: boolean;
  dbDedicated: boolean;
  legacyExcluded: boolean;
}):
  | { DEDICATED_API_AND_DB_MATCH: true; LEGACY_SOURCE_EXCLUDED: true }
  | typeof CREDENTIAL_SOURCE_REJECTED {
  if (!input.apiDedicated || !input.dbDedicated || !input.legacyExcluded) {
    return CREDENTIAL_SOURCE_REJECTED;
  }
  return {
    DEDICATED_API_AND_DB_MATCH: true,
    LEGACY_SOURCE_EXCLUDED: true,
  };
}

export function plannedInitialEmptyGuardSql(): string {
  return plannedCountAndLearnerGuardSql({
    sourceEntries: 0,
    lexemes: 0,
    relations: 0,
    tags: 0,
  });
}

export function plannedVocabularyUpserts(rows: VocabularyImportRows): string {
  const sourceSql = upsertFromJsonSql(
    "vocabulary_source_entries",
    SOURCE_ENTRY_COLUMNS,
    SOURCE_ENTRY_RECORD_TYPES,
    "id",
    jsonCastFromUtf8(rows.sourceEntries),
  );
  const lexemeSql = upsertFromJsonSql(
    "lexemes",
    LEXEME_COLUMNS,
    LEXEME_RECORD_TYPES,
    "id",
    jsonCastFromUtf8(rows.lexemes),
  );
  const abbrevSql =
    rows.lexemeAbbreviationUpdates.length === 0
      ? "select 1"
      : abbreviationUpdateSql(
          jsonCastFromUtf8(
            rows.lexemeAbbreviationUpdates.map((row) => ({
              id: row.id,
              abbreviation_of_lexeme_id: row.abbreviation_of_lexeme_id,
            })),
          ),
        );
  const relationSql = upsertFromJsonSql(
    "lexeme_relations",
    RELATION_COLUMNS,
    RELATION_RECORD_TYPES,
    "id",
    jsonCastFromUtf8(rows.relations),
  );
  const tagSql = upsertFromJsonSql(
    "lexeme_tags",
    TAG_COLUMNS,
    TAG_RECORD_TYPES,
    "lexeme_id",
    jsonCastFromUtf8(rows.tags),
  );
  return [sourceSql, lexemeSql, abbrevSql, relationSql, tagSql].join(";\n");
}
