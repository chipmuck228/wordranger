# Dedicated WordRanger Transactional Direct-Postgres Runner Candidate

Candidate / Not a Standard. **One-shot runner design and local
PostgreSQL 16 proof only. This document does not authorize remote
execution.**

The reviewed live-test harness is not the production runner.
This candidate is the reviewable CLI / executor boundary.

Status:

`POSTGREST_IMPORT_PATH_SUSPENDED`;
`THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED`;
`REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED`;
`WRITE_PROBE_NOT_AUTHORIZED`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

- Date: **2026-09-28**
- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Inspected source head at authoring:
  `edd6e247680742f9845bca7091068ccd1ef5ca0b`
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

Do not store a later PR head SHA here. That is an impossible
self-reference.

## 1. Design gap this runner closes

The local A-H suite proved the transaction contract on a
disposable harness. It did not provide a one-shot executor that:

- exposes `--fingerprint`, `--validate`, `--preflight`,
  `--dry-run`, and `--apply`
- hard-closes `--apply`
- performs identity / TLS classification before any remote SQL
- runs a database-enforced read-only preflight
- refuses PostgREST and the old importer `--apply`

## 2. CLI

`scripts/import-vocabulary-direct-postgres.ts`

| Flag | Behavior |
| --- | --- |
| `--fingerprint` | Local content fingerprint only |
| `--validate` | Local counts and fingerprint only |
| `--dry-run` | Local plan, or local loopback upsert then `ROLLBACK` |
| `--preflight` | Read-only session after identity / TLS gates |
| `--apply` | Always `REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED` |

`--apply` cannot be opened by environment variables, extra flags,
or test tokens. The CLI does not read ambient process env for
credentials. Remote `--dry-run` is refused.

## 3. Future apply contract, still closed

If a later independent authorization opens `--apply`, it must
reuse the reviewed contract: one dedicated connection, `BEGIN`,
`SET LOCAL ROLE service_role`, lock `pg_backend_pid()`, empty
and learner guards, fixed upsert order, same-backend
count / fingerprint / learner checks, commit-ack classes,
read-only reconciliation on a new backend, no retry / resend /
DELETE / TRUNCATE / repair. No pooler. No `Promise.all`.

This document does not open that path.

## 4. Credential and TLS

Remote `--preflight` may use only a one-shot Vercel Production
snapshot file passed as `--credential-snapshot`. Forbidden:
`.env.local`, ambient Supabase / Postgres / Vercel variables,
`--linked`, composing a REST URL into a DB URL, pooler URLs,
`sslmode=disable`, treating `sslmode=require` as verify-full,
`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`,
`curl -k`.

Direct DB TLS must prove hostname and chain. Failure is
`DIRECT_DB_TLS_IDENTITY_NOT_VERIFIED`. That class stops SQL.

Snapshot files stay outside git and end as `TEMP_DELETED`.

## 5. Read-only preflight

After identity and TLS pass:

`BEGIN READ ONLY;`
`SET LOCAL ROLE service_role;`

Then verify `current_user` and `transaction_read_only`, classify
`current_database()` without printing the name, read history
version / name / count, REQUIRED_CORE inventory, vocabulary and
learner counts, privilege matrices, role-switch, schema identity,
and contamination. Then `ROLLBACK`.

No INSERT / UPDATE / DELETE / TRUNCATE / DDL. No COMMIT write
transaction.

## 6. Still closed

- `REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED`
- `POSTGREST_IMPORT_PATH_SUSPENDED`
- `THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED`
- `PR_17_REMAINS_UNMERGED`
- Production remains `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

Expected local fingerprint remains `vocabulary-content-v1` /
`9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`.
