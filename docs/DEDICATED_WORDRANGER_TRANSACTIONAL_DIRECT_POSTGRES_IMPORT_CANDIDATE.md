# Dedicated WordRanger Transactional Direct-Postgres Import Candidate

Candidate / Not a Standard. **Local design and PostgreSQL 16 proof only.
This document does not authorize remote execution.**

Status:

`POSTGREST_IMPORT_PATH_SUSPENDED`;
`THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED`;
`REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED`;
`WRITE_PROBE_NOT_AUTHORIZED`;
`TX_ROLLBACK_NOT_HONORED`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

- Date: **2026-09-28**
- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Historical log-query evidence / remote PR head:
  `41f53c61a1cdabae93d5976732a0200872bdfdeb`
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

Do not store a final PR head SHA here. That is an impossible self-reference.

Read and obey `docs/CURSOR_WORKING_CONTRACT.md`. Frozen Core,
Scheduler, TaskEvaluator, Homepage, `/practice`, and Auth are
unchanged.

This is not a third PostgREST `--apply`. Historical window-1
`42703` was `TABLE_RELATED_NOT_CONFIRMED` and is not treated as
proof that Dedicated rejected `vocabulary_source_entries`.
Local PostgreSQL 16 success is not remote readiness.

`DIRECT_POSTGRES_REMOTE_RUNNER_PATH_RETIRED`.
`EMPTY_TARGET_DASHBOARD_SEED_IS_CURRENT_CANDIDATE`.

A later one-shot remote runner and raw TLS identity probe were
authored, then removed from this PR's selected path. That
removal does not rewrite the historical Gate B, TLS-reset, or
local PostgreSQL 16 facts below. It does not authorize a
Dashboard seed apply.

## 1. Why this candidate

Two Dedicated PostgREST `--apply` attempts failed on first-batch
`SOURCE_ENTRIES_UPSERT`. The PostgREST write path is suspended.
`Prefer: tx=rollback` was not honored. Vocabulary load is a
deployment operation. One direct-Postgres transaction can give
all-or-nothing semantics on a dedicated connection.

## 2. Single-connection transaction

One dedicated PostgreSQL connection owns the whole transaction.
Pooled checkout of a second connection is
`POOLED_TRANSACTION_QUERY_REJECTED`. `Promise.all` across
transaction queries is `PROMISE_ALL_IN_TRANSACTION_REJECTED`.

Backend identity is `SELECT pg_backend_pid()`, captured after
`BEGIN` and re-checked after the role probe, initial guard,
upserts, fingerprint readback, and the pre-commit guard.
A JavaScript wrapper id may appear in logs only. It is not
backend identity.

Order:

1. Acquire one dedicated connection
2. `BEGIN`
3. `SET LOCAL ROLE service_role`
4. Verify `current_user = service_role`
5. `session_user` may be the authorized login role
6. Verify four vocabulary tables start empty
7. Verify six learner tables are zero
8. Deterministic upsert in fixed order
9. Same connection: counts
10. Same connection: content fingerprint
11. Same connection: learner zero again
12. All checks pass → `COMMIT`
13. Any check fails → `ROLLBACK`

Business DML runs only after `SET LOCAL ROLE service_role`.
Owner or superuser bypass of that contract is rejected.
No `DELETE` / `TRUNCATE` of stale rows. No history write.
No schema, grant, RLS, or Vercel change.

## 3. COMMIT outcome and reconciliation

| Client observation | Class |
| --- | --- |
| COMMIT returns and the executor receives the confirmation token | `COMMIT_CONFIRMED` — no reconciliation |
| Executor writes COMMIT, the server commits, then the client confirmation token is suppressed or the session dies before that token arrives | `COMMIT_OUTCOME_UNKNOWN` |

`COMMIT_OUTCOME_UNKNOWN` is classified only from that
executor I/O boundary. Calling a classifier after a normal
COMMIT ACK is not proof.

On `COMMIT_OUTCOME_UNKNOWN`:

- Do not retry import
- Do not resend COMMIT
- Do not DELETE / TRUNCATE / repair
- Open a **new** connection
- On that connection, in order:
  `BEGIN READ ONLY;`
  `SET LOCAL ROLE service_role;`
  then verify `current_user = 'service_role'` and
  `current_setting('transaction_read_only') = 'on'`
- Verify `pg_backend_pid()` differs from the transaction
- Read only counts, fingerprint columns, and learner counts
- `ROLLBACK`
- Any boundary or read failure is
  `COMMIT_RECONCILIATION_FAILED`

Reconciliation classes:

| Observation | Class |
| --- | --- |
| 1600 / 1638 / 716 / 1638, fingerprint `vocabulary-content-v1` / `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`, learner zero | `COMMIT_RECONCILED_COMPLETE` |
| All four vocabulary tables zero and learner zero | `COMMIT_RECONCILED_ROLLED_BACK` |
| Partial counts, fingerprint mismatch, learner non-zero, unread, or identity mismatch | `COMMIT_RECONCILIATION_FAILED` |

`COMMIT_RECONCILIATION_FAILED` stops. No retry, delete, repair,
PostgREST importer, or `/train`. Human review is required.

## 4. Credential and TLS boundary

This section is a historical local-candidate deny list. It is
not an execution path and does not authorize a later remote
runner.

Required classes, if a later task is separately authorized:
`DEDICATED_API_AND_DB_MATCH`, `LEGACY_SOURCE_EXCLUDED`.

Forbidden: `.env.local`, ambient Supabase / Postgres / Vercel
variables, `--linked`, composing a REST URL into a DB URL,
printing URL / host / ref / user / password / JWT / key,
committing credentials, `sslmode=disable`,
`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`,
`curl -k`.

Temporary files stay outside git and end as `TEMP_DELETED`.

The local PostgreSQL 16 harness stays on loopback with its
existing isolation. Remote environment variables must not enter
the child process.

This task does not pull remote credentials. The remote
direct-Postgres runner path is retired. Empty-target Dashboard
seed is the current candidate.

## 5. Still closed

- `POSTGREST_IMPORT_PATH_SUSPENDED`
- `THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED`
- `REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED`
- `WRITE_PROBE_NOT_AUTHORIZED` because `TX_ROLLBACK_NOT_HONORED`
- `PR_17_REMAINS_UNMERGED`
- Production remains `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

## 6. Non-claims

- Remote Dedicated was not written.
- `--apply` was not executed.
- Write probe was not executed.
- Vocabulary remains unimported on Dedicated.
- Learner data was not written.
- PR #17 was not merged.
- Production was not deployed.
- Local PostgreSQL 16 success is not remote authorization.
- This document does not authorize a remote transactional import.
