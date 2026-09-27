# Dedicated WordRanger Baseline V0 Gate B Import Diagnosis

Candidate / Not a Standard. **Local diagnosis and importer
fail-closed hardening. This is not a Gate B retry and not a
successful import.**

Retry remains unauthorized. Diagnosis and hardening do not import
vocabulary. Gate C/D remain unauthorized. PR #17 remains unmerged.
Production remains on `782ffcca670c8272a3ba7ca07bedaef4debdc95f`.

- Date: **2026-09-27**
- Incident commit that this diagnosis extends:
  `e383acd4f410416163f4efd7a874b364e782b11d`
- Authorized remote PR head at diagnosis time:
  `1418efb19a84332cca77384a7c4a11a691862c11`
- Baseline SHA-256:
  `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe`
- Vocabulary fingerprint remains
  `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`

## 1. Confirmed source-level call chain

The reviewed importer that ran during the incident used this chain:

`scripts/import-vocabulary.ts`
→ `createSupabaseServerClient()`
→ `applyVocabularyImport()`
→ `upsertBatch()`
→ Supabase / PostgREST `upsert`

Batch order, then and now. The current importer names each
write with a closed operation so the two `lexemes` stages
are not ambiguous:

1. `vocabulary_source_entries` / `SOURCE_ENTRIES_UPSERT`
2. `lexemes` / `LEXEMES_UPSERT`
3. lexeme abbreviation updates on `lexemes` /
   `LEXEME_ABBREVIATIONS_UPDATE`
4. `lexeme_relations` / `RELATIONS_UPSERT`
5. `lexeme_tags` / `TAGS_UPSERT`

The first possible remote write was `vocabulary_source_entries`
`batchStart=0`, `batchSize=200`. The opaque historical failure does
**not** prove that batch failed. It only proves the importer did not
preserve location.

## 2. Confirmed local defects

These defects are proven by source inspection and the incident
output:

- `createSupabaseServerClient()` chooses
  `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  The importer structurally permitted an anon fallback.
- `createTimedFetch()` wraps every PostgREST call with an abort
  timer (`DEFAULT_PERSISTENCE_TIMEOUT_MS` = 8000). An abort becomes
  `PersistenceTimeoutError`.
- `upsertBatch` threw the raw PostgREST error object:
  `if (error) { throw error; }`.
- `scripts/import-vocabulary.ts` ended with `void main()` and had
  no safe top-level catch.
- Node therefore reported an unhandled promise rejection of an
  opaque object (`#<Object>`), with no table, batch, code, or
  message.
- All four vocabulary tables remained zero after the single
  attempt. Learner tables remained zero.

## 3. Not proven about the historical attempt

The original provider code is unknown.

The original failing table and batch are unknown.

Schema cache is not proven as the historical cause.

Permission failure is not proven as the historical cause.

Timeout is not proven as the historical cause.

Whether a later retry would succeed is unknown.

Do not treat current probe results as the historical write-path
cause.

## 4. Current read-only PostgREST probes

Service-role only. SELECT of one identity column, `limit=0`, no
`count=exact`, no row payloads, no writes.

| Table | Identity column | Classification |
| --- | --- | --- |
| `vocabulary_source_entries` | `id` | `POSTGREST_OTHER_SAFE_ERROR` |
| `lexemes` | `id` | `POSTGREST_OTHER_SAFE_ERROR` |
| `lexeme_relations` | `id` | `POSTGREST_OTHER_SAFE_ERROR` |
| `lexeme_tags` | `lexeme_id` | `POSTGREST_OTHER_SAFE_ERROR` |

Overall:

`CURRENT_POSTGREST_READ_PATH_NOT_FULLY_AVAILABLE`;
`HISTORICAL_OPAQUE_FAILURE_CAUSE_NOT_RECOVERABLE`

A current transport-level probe failure is not evidence that the
historical upsert failed for the same reason. It also does not
prove that a write would succeed.

Direct SQL count-only checks at diagnosis time still showed all
four vocabulary tables and all six learner tables at zero rows.

## 5. Hardening applied locally

- Apply mode now uses `createSupabaseServiceRoleClient()`.
- Missing service-role refuses apply before any client write with
  `VOCABULARY_IMPORT_SERVICE_ROLE_REQUIRED`.
- Anon key does not satisfy apply mode.
- Fingerprint, validate, and dry-run remain usable without
  credentials.
- `VocabularyImportBatchError` preserves table, operation,
  batchStart, and batchSize. Those four fields locate the write
  stage. The closed operations are
  `SOURCE_ENTRIES_UPSERT`,
  `LEXEMES_UPSERT`,
  `LEXEME_ABBREVIATIONS_UPDATE`,
  `RELATIONS_UPSERT`,
  and `TAGS_UPSERT`.
- Public JSON and CLI output keep only a strictly validated
  `providerCode`. Provider message, details, and hint are not
  retained. `Error.cause` stays in-process and is not printed.
- Error kinds:
  `POSTGREST_ERROR`,
  `NETWORK_OR_TIMEOUT_ERROR`,
  `UNKNOWN_IMPORT_ERROR`.
- Top-level rejection handler sets `process.exitCode = 1` and
  prints one sanitized summary. Unknown objects become
  `VOCABULARY_IMPORT_UNKNOWN_FAILURE` with a fixed safe sentence.
- Hardening does not prove that a later retry would succeed.
- Student `/train` clients still use `createSupabaseServerClient()`
  and were not changed.

## 6. Non-claims

- Gate B was not retried.
- `--apply` was not executed against Dedicated in this diagnosis.
- Vocabulary remains unimported.
- Learner data was not written.
- `/train` was not started.
- Vercel env was not modified.
- Production was not deployed.
- PR #17 was not merged.
- Gate C/D remain unauthorized.
