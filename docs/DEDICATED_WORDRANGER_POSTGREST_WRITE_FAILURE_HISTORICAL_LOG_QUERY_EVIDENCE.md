# Dedicated WordRanger PostgREST Write-Failure Historical Log Query Evidence

Candidate / Not a Standard. **Local evidence record of one authorized
read-only historical log query.**
This is not a write probe and not a third import.

This task queried Dedicated logs once, with a fail-closed projection.
It did not POST, PATCH, INSERT, UPSERT, UPDATE, or DELETE.
It did not run `scripts/import-vocabulary.ts --apply`.
It did not open Dashboard SQL Editor.
It did not print payload, JWT, IP, host, or project ref.

- Date: **2026-09-28**
- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Branch head at query time:
  `1401f5d5aab260b8827581beb18e65013446d69c`
- This evidence commit is a later local record. It is not itself
  a write authorization.
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Historical apply heads (advisory):
  `1418efb19a84332cca77384a7c4a11a691862c11`,
  `db6cc6552b280f7b137d88e28888f000cc9aa2db`

Do not store a final PR head SHA here. That is an impossible self-reference.

## 1. Authorization and identity

Pulled the already-authorized Vercel Production snapshot into a
temporary file outside git. Did not read `.env.local`. Did not use
ambient Supabase or Postgres variables. Did not use `--linked`.
The CLI link still points at the legacy project and was excluded.

Management API logs were read with the existing CLI token.
The service-role key was not sent. No vocabulary row was selected.

Classifications:

- `REQUIRED_NAMES_PRESENT`
- `DEDICATED_API_AND_DB_MATCH`
- `LEGACY_SOURCE_EXCLUDED`
- `LINKED_IS_LEGACY_EXCLUDED`
- `SERVICE_ROLE_NOT_USED`
- `TEMP_DELETED`

## 2. Time windows

Commit-bounded hour buckets only. No raw request timestamps.

| Window | Bound | Hour bucket |
| --- | --- | --- |
| `APPLY_1_1418EFB` | after `1418efb` / before incident record `e383acd` | `2026-09-27T02:00Z` |
| `APPLY_2_DB6CC65` | after `db6cc655` / before retry-apply evidence `a6cd979` | `2026-09-27T04:00Z` |

Ages at query time: `22.2h` and `20.6h`.

## 3. Retention

Organization plan class: **`PRO`**.
Official API and database log retention for that class: **7 days**.

| Window | Retention class |
| --- | --- |
| `APPLY_1_1418EFB` | `RETENTION_COVERS_WINDOW` |
| `APPLY_2_DB6CC65` | `RETENTION_COVERS_WINDOW` |

Window 1 also contained at least one `postgres_logs` event, so
retention is not an empty-store artifact. Window 2 is newer than
window 1, so the same 7-day store covers it.

## 4. Projected `postgres_logs`

Selected only `sql_state_code`, hour bucket, and role class.
`event_message`, `parsed.query`, and `parsed.detail` were not
selected and were not printed. Table-name matching, when used,
stayed in the remote `WHERE` clause.

| Window | Table-filtered ERROR | Result |
| --- | --- | --- |
| `APPLY_1_1418EFB` | `vocabulary_source_entries` | `POSTGRES_LOGS_EMPTY` |
| `APPLY_2_DB6CC65` | `vocabulary_source_entries` | `POSTGRES_LOGS_EMPTY` |

Payload-free counts in window 1:

| Count | Value |
| --- | --- |
| all `postgres_logs` | `1` |
| `ERROR` any object | `1` |
| `ERROR` plus table name | `0` |

The single window-1 `ERROR` was then projected without a table
predicate and without message text:

| Field | Class |
| --- | --- |
| time bucket | `2026-09-27T02:00Z` |
| `sql_state_code` | `42703` |
| role class | `AUTHENTICATOR` |
| table related | `NOT_CONFIRMED` |

`42703` is the allowlisted PostgreSQL class for an undefined
column. It is **not** a confirmed `vocabulary_source_entries`
event. Confirming the relation or column name would require
`event_message` or `parsed.query`. That stop is
`CODE_NOT_SEPARABLE_FROM_PAYLOAD` and was not crossed.

Window 2 had `postgres_logs` count `0` in the first projected
pass. No second-window SQLSTATE exists to record.

## 5. Projected `edge_logs`

Queried only after table-filtered Postgres rows were empty.
Selected only hour bucket, method, path class, and HTTP status
class. Request and response bodies were not selected.

No explicit role field was read. Historical identity is
`HISTORICAL_REQUEST_ROLE_NOT_VERIFIED`. Path, status, and time
were not used to infer `service_role`.

| Window | Table-filtered `POST`/`PATCH` | Result |
| --- | --- | --- |
| `APPLY_1_1418EFB` | `REST_VOCABULARY_SOURCE_ENTRIES` | `EDGE_LOGS_EMPTY` |
| `APPLY_2_DB6CC65` | `REST_VOCABULARY_SOURCE_ENTRIES` | `EDGE_LOGS_EMPTY` |

Payload-free counts in window 1:

| Count | Value |
| --- | --- |
| all `edge_logs` | `8` |
| `POST`/`PATCH` any path | `0` |

No allowlisted gateway code (`PGRSTnnn`) was separable from
payload. None is recorded.

A later count-only pass hit HTTP `429` and was stopped.
Window 2 has no extra counts beyond the first projected query.

## 6. Classification

`HISTORICAL_WRITE_LOGS_NOT_FOUND` for table-confirmed write
events.

Additional window-1 fact, not table-confirmed:

`WINDOW_1_ERROR_SQLSTATE_42703`;
`ROLE_AUTHENTICATOR`;
`TABLE_RELATED_NOT_CONFIRMED`

This is not a recovered historical `providerCode` for
`SOURCE_ENTRIES_UPSERT`. It may inform a later design fix.
It does not authorize a write, a write probe, or a third
`--apply`.

## 7. Still closed

- `WRITE_PROBE_NOT_AUTHORIZED` because `TX_ROLLBACK_NOT_HONORED`
- `THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED`
- `PR_17_REMAINS_UNMERGED`
- `PRODUCTION_REMAINS_ON_782FFCC`
- `REMOTE_POSTGREST_WRITE_PATH_REMAINS_SUSPECT`

## 8. Operational safety

- Production alias still
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- Vercel env was not modified
- Production was not redeployed
- `/train` was not started
- PR #17 was not merged
- Dashboard SQL Editor was not used
- Raw log rows were not exported

## 9. Cleanup

- **`TEMP_DELETED`**

## 10. Non-claims

- Vocabulary was not imported.
- Learner data was not written.
- Write probe was not executed.
- `--apply` was not executed.
- A table-confirmed historical write log was not found.
- A gateway `PGRSTnnn` was not recovered.
- Window-1 `42703` is not claimed to be the upsert.
- The undefined column name was not read.
- Historical request role was not verified.
- PR #17 was not merged.
- Production was not deployed.
- This document does not authorize another log dump, write
  probe, third import, merge, or Production promotion.
