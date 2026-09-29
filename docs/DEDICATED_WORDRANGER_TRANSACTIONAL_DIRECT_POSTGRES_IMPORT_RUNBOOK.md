# Dedicated WordRanger Transactional Direct-Postgres Import Runbook

Candidate / Not a Standard. **Historical local-candidate runbook.
This document does not authorize remote execution.**

`DIRECT_POSTGRES_REMOTE_RUNNER_PATH_RETIRED`;
`EMPTY_TARGET_DASHBOARD_SEED_IS_CURRENT_CANDIDATE`;
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

The selected vocabulary initialization path is the empty-target
Dashboard seed. The remote one-shot runner is retired and is not
an execution entry.

Default Vitest must not load the historical local live file.
To replay the local PostgreSQL 16 transactional-candidate suite
after `postgresHarnessAvailable()` is true:

```
RUN_DEDICATED_TRANSACTIONAL_DIRECT_POSTGRES_IMPORT=1
./node_modules/.bin/vitest run
--config vitest.transactional-direct-postgres.config.ts
```

That command is local loopback only. It is not a Dedicated
import. Do not export remote URLs into the child environment.

## 2. Retired remote runner path

This section is historical. It is not authorization and not an
execution checklist.

A later remote runner, credential snapshot, and raw TLS identity
probe were authored and then removed from this PR's selected
path. They are not replaced by PostgreSQL SSLRequest, pooler
fallback, or a new network probe.

The local candidate still records that COMMIT confirmation is
classified only from the executor I/O boundary, that
reconciliation used `BEGIN READ ONLY` plus
`SET LOCAL ROLE service_role` on a different `pg_backend_pid()`,
and that those facts were local proof only.

Do not start `/train`. Do not run the PostgREST importer.
Do not write history. Do not change Vercel.

## 3. Non-claims

- Remote Dedicated was not contacted in this task.
- This runbook is not remote authorization.
- PR #17 remains DO NOT MERGE.
- Production remains `782ffcc`.
