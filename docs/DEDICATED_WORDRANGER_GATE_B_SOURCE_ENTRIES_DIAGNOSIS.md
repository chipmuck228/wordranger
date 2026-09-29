# Dedicated WordRanger Gate B Source Entries Diagnosis

Candidate / Not a Standard. **Local diagnosis of the stable first-batch
`SOURCE_ENTRIES_UPSERT` failure.** This is not a third import attempt
and not a successful Gate B.

The inspected retry head is
`db6cc6552b280f7b137d88e28888f000cc9aa2db`.
The later local retry-apply evidence commit is
`a6cd97997115ae6e0b914b41077e58fad1de0e9a`.
This diagnosis commit is a still later local record.

This task did not run `scripts/import-vocabulary.ts --apply`.
It did not persist remote rows. It did not refresh the remote
schema cache. A third import attempt is not authorized.

- Date: **2026-09-27**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Inspected remote PR head:
  `db6cc6552b280f7b137d88e28888f000cc9aa2db`
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

## 1. Identity

| Input | Value |
| --- | --- |
| Baseline SHA-256 | `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe` |
| Fingerprint | `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb` |
| Expected counts | `1600` / `1638` / `716` / `1638` |
| `apply-import.ts` after sibling-status fix | `3b65732cafc8d03e306b75b82654c56ac0fdb6afbdc1f55d71b436a7d7731b53` |
| Prior `apply-import.ts` lock | `22ec38aa8a0ac163c56503470662eb652c71621e535d7cb426a7bc0cbafef74f` |
| `import-rows.ts` | `44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36` |
| `batch-error.ts` after sibling-status fix | `2558791095682ee404232277954c0f542156f2bc0af645b70adb2fc29efd4ce6` |
| Prior diagnosis `batch-error.ts` lock | `f36361f763a04cc5682841bb1c856fc2cc130506d236f6216ebfb656091b807b` |
| Prior evidence `batch-error.ts` lock | `70a088d0a096593bc4f407606eb080344539d82f8a8014066e256627cc8d6c01` |

Remote history, schema, and zero-row counts were re-checked
read-only and had not drifted.

## 2. Observed public failure

Two remote `--apply` attempts have failed. The authorized retry
recorded:

| Field | Value |
| --- | --- |
| operation | `SOURCE_ENTRIES_UPSERT` |
| table | `vocabulary_source_entries` |
| batchStart | `0` |
| batchSize | `200` |
| kind | `POSTGREST_ERROR` |
| providerCode | null |

All vocabulary and learner tables remained zero.

`kind = POSTGREST_ERROR` with a null `providerCode` does **not**
identify a SQLSTATE or `PGRSTnnn`. The classifier already treated
a PostgREST-shaped object (`message` plus a defined `details`
field) as `POSTGREST_ERROR` even when `code` was missing or failed
the allowlist. That is a public-output gap, not a recovered remote
cause.

## 3. Importer first-batch contract

`upsertBatch` calls `client.from(table).upsert(slice)` with no
`onConflict`, no schema override, no returning option, and no
resolution override. Supabase JS / PostgREST therefore uses the
table primary key as the conflict target.

The first 200 mapped `vocabulary_source_entries` rows:

- row count `200`
- distinct payload keys `15`
- extra baseline-unknown keys `0`
- missing mapped keys `0`
- `undefined` values `0`
- JSON payload bytes `82997`
- `raw_entry` text bytes `9044`

Field categories for those 200 rows:

| Field | JS category | Empty string | Notes |
| --- | --- | --- | --- |
| `id` | string 200 | 0 | UUID shape 200 / 200 |
| `canonical_key` | string 200 | 0 | |
| `source_index` | number 200 | 0 | |
| `section` | string 200 | 0 | |
| `source_page_start` | number 200 | 0 | |
| `source_page_end` | number 200 | 0 | |
| `source_word_raw` | string 200 | 0 | |
| `starred` | boolean 200 | 0 | |
| `source_ipa_raw` | string 197 / null 3 | 0 | |
| `source_pos_raw` | string 200 | 0 | |
| `source_meaning_raw` | string 200 | 0 | |
| `raw_entry` | string 200 | 0 | |
| `parse_status` | string 200 | 0 | |
| `parse_issues` | array 200 | 0 | length 0: 197; length 1: 3 |
| `source_review_note` | null 198 / string 2 | 0 | |

No business words, lemmas, or raw row bodies are recorded here.

`created_at` is omitted from the payload. That is required: the
column is `timestamptz not null default now()`.

## 4. Remote catalog matrix

Read-only `information_schema` / `pg_catalog` plus PostgREST
`limit=0` column probes. No INSERT / UPSERT / UPDATE / DELETE /
TRUNCATE. Schema cache was not reloaded.

Remote `vocabulary_source_entries` columns match the formal
baseline exactly:

| Column | Type | Null | Default | Generated / identity | In first-batch payload |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | no | none | no | yes |
| `canonical_key` | text | no | none | no | yes |
| `source_index` | integer | no | none | no | yes |
| `section` | text | yes | none | no | yes |
| `source_page_start` | integer | yes | none | no | yes |
| `source_page_end` | integer | yes | none | no | yes |
| `source_word_raw` | text | no | none | no | yes |
| `starred` | boolean | no | `false` | no | yes |
| `source_ipa_raw` | text | yes | none | no | yes |
| `source_pos_raw` | text | yes | none | no | yes |
| `source_meaning_raw` | text | no | `''` | no | yes |
| `raw_entry` | text | yes | none | no | yes |
| `parse_status` | text | yes | none | no | yes |
| `parse_issues` | jsonb | no | `'[]'::jsonb` | no | yes |
| `source_review_note` | text | yes | none | no | yes |
| `created_at` | timestamptz | no | `now()` | no | no |

Constraints:

- primary key `(id)`
- unique `(canonical_key)`
- unique `(source_index)`
- no check constraints
- no foreign keys on this table
- no sequence
- no user triggers

`onConflict` unspecified therefore targets the real PK `(id)`.
That is a valid unique/PK target. The extra unique columns are
not required for an empty-table insert.

Privileges and RLS:

- `service_role` has `USAGE` on `public`
- table `SELECT` / `INSERT` / `UPDATE` yes; `DELETE` no
- RLS disabled; FORCE RLS disabled; policies `0`
- no sequence privilege is required

PostgREST `limit=0` reads:

- `select=id` → `POSTGREST_READ_OK`
- all 15 importer columns → `POSTGREST_READ_OK`
- `select=created_at` → `POSTGREST_READ_OK`

The schema cache currently recognizes the table, every importer
field, and the default-only `created_at` column. That does not
prove a write would succeed.

History remained one row
`202609260001` / `dedicated_wordranger_baseline_v0`.
All required vocabulary and learner tables remained zero.

## 5. Local PostgreSQL 16 equivalent

The repository has no pinned PostgREST runtime. This diagnosis
did not download an unversioned PostgREST binary.

A disposable local PostgreSQL **16.15** cluster applied the formal
baseline, created the same `anon` / `authenticated` /
`service_role` roles, and used `service_role` to insert the same
first-batch column set with:

`INSERT ... SELECT * FROM json_to_recordset(...) AS x(...)`
`ON CONFLICT (id) DO UPDATE`

Limitation: this is a SQL column-set and PK conflict simulation,
not a remote PostgREST HTTP upsert.

Result:

- first batch inserted `200` rows
- `created_at` nulls `0`
- learner `learning_tasks` remained `0`
- no SQLSTATE / constraint failure
- cluster stopped and removed

Isolated PGlite already seeds the full mapped dataset against the
same baseline columns. That also failed to show a payload/schema
mismatch.

## 6. Error-classification hardening

Public CLI remains fail-closed. Provider message, hint, details,
cause, headers, URL, and payload stay out of public JSON.

`statusClass` is classified only from the sibling `status` field
on the Supabase upsert response. It is not read from the inner
provider error object's `status`, `statusCode`, or `status_code`.

Allowlisted public values:

- `HTTP_4XX`
- `HTTP_5XX`
- `NO_STATUS`

The public JSON still contains only `statusClass`. The raw HTTP
status number is not stored or printed.

The two historical Dedicated `--apply` failures still have no
recoverable status. This change only improves safe observability
for a later independently authorized probe or attempt. It does
not prove that a retry would succeed.

It still accepts only SQLSTATE / `PGRSTnnn` as `providerCode`.
Attack tests keep secret, URL, JWT, email, lemma, and nested row
content out of public output.

This does not recover the historical or retry write-path cause.

## 7. Conclusion

`LOCAL_CONTRACT_MATCHES_REMOTE_CATALOG`;
`REMOTE_POSTGREST_WRITE_PATH_REMAINS_SUSPECT`;
`THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

A later independently authorized write probe would still be
required to observe a sanitized remote write-path code. This
document does not authorize that probe, a third `--apply`,
delete, repair, merge, or Production change.

## 8. Non-claims

- Gate B was not retried a third time.
- `--apply` was not executed against Dedicated.
- Vocabulary remains unimported.
- Learner data was not written.
- `/train` was not started.
- Vercel env was not modified.
- Production was not deployed.
- PR #17 was not merged.
- Runtime has not been accepted.
