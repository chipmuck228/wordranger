# Dedicated WordRanger Transactional Direct-Postgres Import Runbook

Candidate / Not a Standard. **Runbook for the local candidate.
This document does not authorize remote execution.**

`REMOTE_TRANSACTIONAL_IMPORT_NOT_AUTHORIZED`;
`POSTGREST_IMPORT_PATH_SUSPENDED`;
`THIRD_IMPORT_ATTEMPT_NOT_AUTHORIZED`;
`PR_17_REMAINS_UNMERGED`;
`PRODUCTION_REMAINS_ON_782FFCC`

- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- Historical log-query evidence / remote PR head:
  `41f53c61a1cdabae93d5976732a0200872bdfdeb`
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

Do not store a final PR head SHA here. That is an impossible self-reference.

## 1. Local proof only

Default Vitest must not load the live file. To run the
PostgreSQL 16 suite after `postgresHarnessAvailable()` is true:

```
RUN_DEDICATED_TRANSACTIONAL_DIRECT_POSTGRES_IMPORT=1
./node_modules/.bin/vitest run
--config vitest.transactional-direct-postgres.config.ts
```

That command is local loopback only. It is not a Dedicated
import. Do not export remote URLs into the child environment.

## 2. If a later remote authorization exists

This section is not authorization.

1. Pull a one-shot Vercel Production snapshot outside git.
2. Classify `DEDICATED_API_AND_DB_MATCH` and
   `LEGACY_SOURCE_EXCLUDED`. Stop if either fails.
3. Refuse `.env.local`, ambient variables, `--linked`, and REST
   URL composition.
4. Require certificate-verified TLS. Refuse `sslmode=disable`,
   `rejectUnauthorized: false`,
   `NODE_TLS_REJECT_UNAUTHORIZED=0`, and `curl -k`.
5. Open one dedicated direct-Postgres connection.
6. Follow the transaction order in the Candidate document.
7. On `COMMIT_CONFIRMED`, stop. Do not reconcile.
8. On `COMMIT_OUTCOME_UNKNOWN`, do not retry, do not resend
   COMMIT, do not delete. That class comes only from the
   executor I/O boundary after COMMIT is written. Open a new
   connection, `BEGIN READ ONLY`, `SET LOCAL ROLE service_role`,
   verify `current_user` and `transaction_read_only`, verify a
   different `pg_backend_pid()`, classify reconciliation, then
   `ROLLBACK`.
9. On `COMMIT_RECONCILIATION_FAILED`, stop for human review.
10. Delete the temporary snapshot. Record `TEMP_DELETED`.

Do not start `/train`. Do not run the PostgREST importer.
Do not write history. Do not change Vercel.

## 3. Non-claims

- Remote Dedicated was not contacted in this task.
- This runbook is not remote authorization.
- PR #17 remains DO NOT MERGE.
- Production remains `782ffcc`.
