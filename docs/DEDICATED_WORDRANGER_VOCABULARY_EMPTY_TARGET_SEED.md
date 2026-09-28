# Dedicated WordRanger Empty-Target Vocabulary Seed

Candidate / Not a Standard. **Authored and locally validated only.**
This document does not authorize a Dashboard apply, a third
PostgREST `--apply`, a remote direct-Postgres runner, a Production
switch, or a learner-data migration.

Status:

`REMOTE_EMPTY_TARGET_SEED_APPLY_NOT_AUTHORIZED`;
`NO_LEARNER_DATA_MIGRATION_REQUIRED`;
`PR_17_REMAINS_DO_NOT_MERGE`;
`PRODUCTION_REMAINS_ON_782FFCC`

- Date: **2026-09-28**
- `origin/main` / merge-base:
  `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- Production alias remains
  `782ffcca670c8272a3ba7ca07bedaef4debdc95f`

Do not store a later PR head SHA here. That is an impossible
self-reference.

`DIRECT_POSTGRES_REMOTE_RUNNER_PATH_RETIRED`.
`EMPTY_TARGET_DASHBOARD_SEED_IS_CURRENT_CANDIDATE`.

This candidate is the selected vocabulary initialization path.
The remote direct-Postgres runner and raw TLS identity probe
were removed from this PR's scope. Historical Gate B, capability
GET, and IPv6 TLS-reset facts remain historical. They are not
rewritten as if they never happened.

This candidate does not use the following as the vocabulary
initialization path:

- remote direct-Postgres runner / TLS preflight
- direct IPv6 TLS channel
- Supavisor Session Pooler Candidate
- PostgREST rollback write probe
- a third PostgREST `--apply`
- commit-ack-loss production reconciliation
- learner or user data migration
- Blaze data copy

## 1. What this artifact is

A single, reviewable, deterministic SQL file that can later be
pasted into the Dedicated WordRanger Dashboard SQL Editor:

`supabase/seeds/dedicated_wordranger_vocabulary_v0.sql`

It is not an active migration. It must not be placed in
`supabase/migrations/` or `supabase/migrations_archive/`.
It must not write `supabase_migrations.schema_migrations`.

Generator:

- `scripts/generate-dedicated-vocabulary-seed.ts`
- `--write` authors the file
- `--check` regenerates in memory and compares byte-for-byte

Shared helper:

`src/server/vocabulary/import/empty-target-vocabulary-seed.ts`

The generator reuses repository vocabulary JSON,
`toVocabularyImportRows()`, and `effectiveVocabularyImportRows()`.
Abbreviation is taken from the existing mapper's **final** value,
not from a later mutation statement.

## 2. Contract

| Item | Value |
| --- | --- |
| Fingerprint version | `vocabulary-content-v1` |
| Expected fingerprint | `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb` |
| `vocabulary_source_entries` | 1600 |
| `lexemes` | 1638 |
| `lexeme_relations` | 716 |
| `lexeme_tags` | 1638 |
| Baseline file | `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql` |
| Baseline SHA-256 | `7f62b1818cae5045b5d74e2dd286a510f21da650ff6dea42357ac3e4d8f9a0fe` |

Allowed writes, in FK order:

1. `public.vocabulary_source_entries`
2. `public.lexemes`
3. `public.lexeme_relations`
4. `public.lexeme_tags`

The six learner tables stay at zero and are never written:

- `learning_tasks`
- `game_sessions`
- `learning_evidence`
- `student_lexeme_models`
- `student_lexeme_skill_states`
- `student_lexeme_weaknesses`

Transaction boundary:

```text
begin;
set local role service_role;
-- empty-target and learner-zero preconditions
-- four INSERTs
-- count / reference / field assertions
commit;
```

There is exactly one top-level transaction. Failure raises and
rolls the whole unit back. Repeat execution must fail the
empty-target precondition. The SQL does not use mutation of
existing rows, conflict targets, dynamic SQL, RPC, HTTP, or
`COPY` from a local path.

`created_at` / `updated_at` are omitted so database defaults apply.

## 3. Two proof layers

SQL cannot honestly recompute the TypeScript
`vocabulary-content-v1` fingerprint. It therefore proves only:

- exact counts
- learner tables remain zero
- source / lexeme / relation / tag references exist
- required business fields are non-empty
- abbreviation count and abbreviation-pair digest match the mapper

It does **not** claim `DATABASE_CONTENT_FINGERPRINT_VERIFIED`.

Local PostgreSQL 16 live proof reads the same business columns
back and calls the same TypeScript
`fingerprintVocabularyImportRows()` function. That layer must
equal `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb`.

Correct counts are not content correctness.

A later remote apply, if separately authorized, should record
`REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED` unless a later
task honestly recomputes the TypeScript fingerprint from a
complete readback.

## 4. Local verification

Default Vitest must not discover the live module.

```text
npx tsx scripts/generate-dedicated-vocabulary-seed.ts --check
./node_modules/.bin/vitest run tests/persistence/dedicated-vocabulary-empty-target-seed.test.ts
RUN_DEDICATED_VOCABULARY_EMPTY_TARGET_SEED=1 ./node_modules/.bin/vitest run --config vitest.vocabulary-empty-target-seed.config.ts
```

Live suite A–H uses a disposable local PostgreSQL 16 cluster
only. It does not open a remote database and does not authorize
Dashboard apply.

## 5. Future Dashboard apply runbook

All boxes stay unchecked. This task must not execute them.

### Pre-apply

- [ ] Confirm the target is the Dedicated WordRanger project
- [ ] Confirm migration history is only `202609260001` /
      `dedicated_wordranger_baseline_v0`
- [ ] Confirm four vocabulary tables are zero
- [ ] Confirm six learner tables are zero
- [ ] Confirm the seed SHA-256 matches the reviewed artifact
- [ ] Confirm Production still points at
      `782ffcca670c8272a3ba7ca07bedaef4debdc95f`
- [ ] Confirm there is no user data to migrate

### Apply

- [ ] Open Dedicated Dashboard SQL Editor
- [ ] Load the exact committed seed SQL
- [ ] Do not edit the SQL
- [ ] Execute once
- [ ] Do not retry
- [ ] Do not split the transaction
- [ ] Do not use CLI `db push`
- [ ] Do not change migration history

### Post-apply

- [ ] Read-only four-table counts
- [ ] Read-only FK / integrity
- [ ] Learner six tables still zero
- [ ] Grants / RLS unchanged
- [ ] History unchanged
- [ ] Optional / shared objects still absent
- [ ] Record `REMOTE_CONTENT_FINGERPRINT_NOT_YET_VERIFIED`
      unless a later authorized readback recomputes the TypeScript
      fingerprint

Still separately unauthorized after a successful apply:

- merge PR #17
- Production deploy
- `/train` write smoke
- enabling `/practice`, Homepage, or Auth
