# Dedicated Baseline V0 History Atomicity Spike

Local verification only. This document does not authorize Dedicated or
Blaze SQL, `db push` to a remote, history repair, vocabulary import,
learner writes, a Production deployment, a merge, or a PR update.

- Date: **2026-09-26**
- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- Remote PR **#17** head: `bb6e522e4db350ca915dade672cbed786f6a7bd1`
- Local HEAD when this spike ran: `7aafc0919ec493637385fb9b156b800595c1d2da`
- Production alias: `782ffcca670c`
- CLI: **Supabase CLI 2.118.0**
- Baseline version: `202609260001`
- Spike-time formal baseline SHA-256:
  `0ca22a8adba187ad4cc9255d357ab4c9da94dbc2e0a401fe65e6afc73e096b35`
- Follow-up formal baseline SHA-256 after removing authored
  `begin;` / `commit;`:
  `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe`

Verdict of the original spike:

**A. `CLI_ATOMIC_BASELINE_CHANNEL_PROVEN_LOCALLY`;
`FORMAL_BASELINE_CHANGE_REQUIRED`;
`NO_REMOTE_CHANGES`**

The spike-time formal baseline wrapped schema in authored `begin;` /
`commit;`. That path is **not** atomic with the CLI history insert.
Removing those two statements, and applying through CLI 2.118.0
`db push --db-url` or `migration up --db-url`, **was** proven atomic on
disposable local PostgreSQL 16.15.

A later local Candidate change applied that formal removal. This
file keeps the spike evidence. It does not authorize remote apply.

## 1. CLI version and source implementation

Installed binary: `npx supabase --version` → `2.118.0`.

This release’s apply path is the TypeScript CLI (`apps/cli`), not the
legacy Go `apps/cli-go` tree. Citations below are from tag `v2.118.0`.
Help text was not used as the transaction-semantics source.

| File | Function / symbol | Role |
| --- | --- | --- |
| `apps/cli/src/command-internal/migration-file.ts` | `parseMigrationContent`, `splitAndTrim` | Splits SQL on `;`. `-- pg-delta: transaction=false` can mark a file non-transactional. |
| `apps/cli/src/command-internal/migration-apply.ts` | `hasTransactionControl` | True when any statement matches `BEGIN` / `START TRANSACTION` / `COMMIT` / `END` / `ABORT` / `PREPARE TRANSACTION`. `ROLLBACK TO` is not treated as control. |
| same | `executeSequentially` | File with transaction control: each statement via `session.exec`, then history insert **after** every file statement succeeds. On error, cleanup `ROLLBACK`. |
| same | `flushBatch` / `execMigrationBatch` | File **without** transaction control: file statements, optional role restore, and `INSERT_MIGRATION_VERSION` are one `execBatch`. |
| `apps/cli/src/command-internal/migration-history.ts` | `INSERT_MIGRATION_VERSION` | `INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES($1, $2, $3)`. |
| same | `createMigrationTable` | Separate setup transaction (`BEGIN` … `COMMIT`) **before** apply. Skipped when the provisioning probe already sees `version`, `name`, `statements`. |
| `apps/cli/src/command-internal/db-push-core.ts` | `dbPushCore` | Calls `applyMigrations`. |
| `apps/cli/src/commands/migration/up/up.handler.ts` | `runUp` | Calls `applyMigrationFile` for each pending file. |
| `apps/cli/src/command-internal/db-connection.sql-pg.layer.ts` | `PgBatchQuery.submit`, `execBatch` | Extended-protocol pipeline: Parse/Bind/Describe/Execute per statement, **one** `Sync` at the end. This layer does **not** inject `BEGIN`/`COMMIT`. |

Shared executor: `db push --db-url` and `migration up --db-url` both
end in `applyMigrationFile` / `execMigrationBatch`. This spike
reproduced the same A/B/C schema/history states on both commands.

Authored `BEGIN`/`COMMIT` therefore **cannot** share a transaction with
the history insert: the file’s `COMMIT` ends the authored block, then
the CLI inserts history. Source predicted half-state on history
failure. Experiment C confirmed it.

No-authored files put schema statements and the history insert in one
`execBatch`. `PgBatchQuery` does not wrap `BEGIN`/`COMMIT`. Local
PostgreSQL 16.15 still committed or rolled back that batch together.
That is the proven Option A channel. It is an observed protocol-batch
behavior, not a help-text inference.

## 2. Local PostgreSQL environment

- Server: Homebrew `postgresql@16` **16.15** binaries only
- Not used: PGlite, Docker, Supabase local Docker stack, brew
  `postgresql@16` service, default cluster
  `/opt/homebrew/var/postgresql@16`
- Harness: `initdb` in `os.tmpdir()`, `listen_addresses = '127.0.0.1'`,
  random free port, random database name `spike_<hex>`
- Role: local trust user `spike`
- CLI `--db-url` host was `127.0.0.1` with `sslmode=disable`
  (CLI 2.118.0 refuses plaintext unless that query is set)
- Observed `inet_server_addr()`: `127.0.0.1/32`
- CLI still prints “Connecting to remote database…” for `--db-url`.
  That is CLI target classification, not Dedicated or Blaze.
- `--linked`, `--include-all`, `--include-seed`, `--include-roles`
  were not used
- `--workdir` pointed at a disposable fixture tree so the formal
  `supabase/migrations/` baseline was never the apply input

## 3. Current authored transaction A/B/C

Fixture used the same wrapper as the formal baseline:

```sql
begin;
-- schema statements --
commit;
```

Schema body was a single `public.spike_probe` table. Version numbers
were disposable (`20260926991xx`), not `202609260001`.

History-insert failure (C) was a real `BEFORE INSERT` trigger on
`supabase_migrations.schema_migrations` that raised
`SPIKE_HISTORY_INSERT_REJECTED` (`SQLSTATE 23514`). The process was
not killed.

| Command | Case | Schema `spike_probe` | History row | Half-state |
| --- | --- | --- | --- | --- |
| `db push --db-url` | A success | present | one row | no |
| `db push --db-url` | B mid-schema `select 1 / 0` | absent | absent | no |
| `db push --db-url` | C history trigger | **present** | **absent** | **yes** |
| `migration up --db-url` | A / B / C | same as `db push` | same | same |

A success history shape:

- `version`: the fixture timestamp
- `name`: `spike_success`
- `statements`: `["begin", "create table public.spike_probe (...)", "commit"]`

C error (authored): history insert is **statement 3**, after the file
`commit`. Schema remains. Current baseline + CLI channel is **unsafe**.

## 4. No-authored-transaction A/B/C

Temporary git-external fixture only. Same schema statements, no
`begin;` / `commit;`.

| Command | Case | Schema `spike_probe` | History row | Half-state |
| --- | --- | --- | --- | --- |
| `db push --db-url` | A success | present | one row | no |
| `db push --db-url` | B mid-schema `select 1 / 0` | absent | absent | no |
| `db push --db-url` | C history trigger | **absent** | **absent** | **no** |
| `migration up --db-url` | A / B / C | same as `db push` | same | same |

A success history shape:

- `version`: the fixture timestamp
- `name`: `spike_success`
- `statements`: `["create table public.spike_probe (...)"]`

C error (no-authored): history insert is **statement 1** in the same
batch as `CREATE TABLE`. Both rolled back. This is the proven atomic
CLI channel.

## 5. Schema / history state for every failure

| Shape | Failure | After state |
| --- | --- | --- |
| authored | B schema `22012` at statement 2 | no probe table; no version row; history table may exist from CLI setup |
| authored | C history `23514` at statement 3 (`INSERT_MIGRATION_VERSION`) | probe table **exists**; version row **missing** |
| no-authored | B schema `22012` at statement 1 | no probe table; no version row |
| no-authored | C history `23514` at statement 1 (`INSERT_MIGRATION_VERSION`) | no probe table; no version row |

Success always produced exactly one version row whose `version`
matched the filename prefix.

## 6. Option A / B judgment

**Option A is proven locally.** The follow-up local Candidate change
removed authored `begin;` / `commit;` from the formal baseline. CLI
2.118.0 `db push --db-url` (or `migration up --db-url`) is the
proven local channel so schema statements and the real
`supabase_migrations.schema_migrations` insert share one batch.

Remote Dedicated apply remains unauthorized until later catalog,
connection-identity, and human-authorization gates pass.

**Option B is not opened.** A repo-owned bootstrap runner is
unnecessary while Option A is locally proven. Do not implement a
custom history writer in this spike.

Remote Dedicated apply remains unauthorized until all of the
following happen in a later task: formal baseline loses authored
transaction control, Gate A catalog-empty evidence is satisfied, and
a new authorization names a Dedicated-only `--db-url` source. This
spike does not grant that.

## 7. Authorized DB connection variable-name classification

Names-only inventory of already-authorized Production configuration.
Values were not read, pulled, printed, or used.

**`DEDICATED_DIRECT_DB_CONNECTION_NAME_PRESENT`**

REST URL + service-role names are not a `--db-url`. No PostgreSQL
connection string was constructed from a project ref.

## 8. Disposable database / container cleanup

Each live run:

1. `pg_ctl stop -m fast`
2. recursive delete of the `initdb` directory
3. recursive delete of each fixture `--workdir`

After the passing live run: no leftover `wr-baseline-atomicity-*`
clusters, no leftover `wr-spike-fixture-*` directories, no leftover
spike `postgres` processes. Homebrew `postgresql@16` service remained
`none`.

## 9. Files changed

Added:

- `docs/DEDICATED_BASELINE_V0_HISTORY_ATOMICITY_SPIKE.md`
- `tests/persistence/dedicated-baseline-history-atomicity-harness.ts`
- `tests/persistence/dedicated-baseline-history-atomicity.integration.test.ts`

Updated:

- `.gitignore` — ignore `.local-spike/` leftovers only

Not changed:

- formal baseline SQL
- Candidate / apply-plan / checklist docs
- PR #17
- Vercel env
- Dedicated or Blaze data

Fixtures are created under `os.tmpdir()` and deleted in `finally`.
They are not committed.

## 10. Tests

Static (always):

- formal baseline has no authored top-level `begin;` / `commit;`
- installed CLI is `2.118.0`
- harness refuses non-local `--db-url` hosts

Live (opt-in, real PostgreSQL, not PGlite):

```bash
RUN_DEDICATED_BASELINE_ATOMICITY_SPIKE=1 npx vitest run \
  tests/persistence/dedicated-baseline-history-atomicity.integration.test.ts
```

The live matrix covers `db-push` and `migration-up` × authored and
no-authored × A/B/C (12 applies). It skips when the env flag is unset
or PostgreSQL 16 binaries are missing.

Verified this session: live matrix passed once under the opt-in flag;
default `vitest` run skips the live matrix.

## 11. Zero remote access / write

- No Dedicated SQL
- No Blaze SQL
- No `.env.local` read
- No `vercel env pull`
- No remote `db push` / `migration up` / history repair
- No push, PR update, merge, or Production deploy
- No vocabulary import
- No learner writes
- Phase 5 used names-only listing of already-authorized Production
  env **names**; no values

CLI `--db-url` targets were `127.0.0.1` only.
