# Dedicated WordRanger Baseline V0 Remote Apply Plan

Candidate / Not a Standard. **Read-only plan. Nothing below is authorized
or executed by this document.**

Gate A is **BLOCKED**. No remote apply is authorized. Dashboard SQL
Editor is not the apply channel.

- Date: **2026-09-26**
- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- PR head: `bb6e522e4db350ca915dade672cbed786f6a7bd1`
- Branch: `migration/dedicated-wordranger-baseline-candidate-v0`
- Production alias remains the known-good `782ffcca670c` rollback
- Active baseline:
  `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql`
- Baseline version: `202609260001`
- This file is a future-authorization runbook. It does not apply
  schema, import vocabulary, merge the PR, or change Vercel env.

Read and obey `docs/CURSOR_WORKING_CONTRACT.md`. This plan does not
change frozen Core, Scheduler, TaskEvaluator, Homepage, `/practice`,
or Auth.

## 0. Current verified state

Verified this planning pass. Values were classified; infrastructure
identifiers were not written here.

| Fact | Result |
| --- | --- |
| Git identity | `origin/main`, merge-base, PR head, and active baseline match the expected identity |
| PR #17 | OPEN, not merged, Bugbot thread resolved, no unresolved review threads |
| Production alias | still `782ffcca670c` |
| Vercel Production configuration | `POINTS_TO_DEDICATED_TARGET` |
| Vercel Preview configuration | same Dedicated target as Production; not acceptance |
| Vercel Development | `NOT_CONFIGURED` |
| Dedicated target identity | `DEDICATED_TARGET_MATCH` |
| API emptiness probe | `TARGET_OBJECTS_NOT_EXPOSED_OR_NOT_FOUND` (`PGRST205` on REQUIRED_CORE and shared names). Auxiliary only. |
| Catalog emptiness | not `TARGET_EMPTY_CATALOG_VERIFIED`. Gate A stays blocked until an authorized read-only catalog query proves it. |
| Production `SUPABASE_SERVICE_ROLE_KEY` name | present |
| Local CLI link | legacy source, **not** the Dedicated target. Forbidden for catalog, apply, list, and query. |
| Observed CLI | `npx supabase` **2.118.0**. Re-check help before any later apply. |
| Gate A | **BLOCKED** — no proven atomic schema-plus-history channel |

`FREE_PRACTICE_ENABLED`, `FREE_PRACTICE_RUNTIME`, and
`CONTEXT_LAB_ENABLED` remain unset on Production.

`PGRST205` is not catalog-empty proof. Do not treat the API probe
as `TARGET_EMPTY_CATALOG_VERIFIED`.

If any later check disagrees with this table, stop.

## 1. Immutable deployment identity

These values are the authorization inputs. Any SHA or fingerprint
change requires a new review. Do not apply a drifted tree.

| Input | Value |
| --- | --- |
| PR head | `bb6e522e4db350ca915dade672cbed786f6a7bd1` |
| Active baseline path | `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql` |
| Baseline version | `202609260001` |
| Baseline SHA-256 | `0ca22a8adba187ad4cc9255d357ab4c9da94dbc2e0a401fe65e6afc73e096b35` |
| Vocabulary `algorithmVersion` | `vocabulary-content-v1` |
| Vocabulary fingerprint | `9704c2025628676800918e4e7fc0e744c8358c025d8b01ebf43936d8474754cb` |
| `sourceEntries` | `1600` |
| `lexemes` | `1638` |
| `relations` | `716` |
| `tags` | `1638` |
| Importer commit identity | `82a9eccfa8cdf6e6e2ed89322742a5cef6e3a46b` (importer sources last changed there; Gate B still uses the PR head tree) |
| Dedicated target identity | `DEDICATED_TARGET_MATCH` |
| Production alias rollback | `782ffcca670c8272a3ba7ca07bedaef4debdc95f` |

Importer file hashes at PR head, advisory only:

| File | SHA-256 |
| --- | --- |
| `src/server/vocabulary/import/import-rows.ts` | `44226a3722c14c51bc76f9c3da05674e166a2dffa7cf409e4ce5ba9844ff6d36` |
| `src/server/vocabulary/import/rebuild-contract.ts` | `b39ea86209bee55c7659a3ad1f4261bb708ed23fd9d104cf120f07b63ea825cb` |
| `src/server/vocabulary/import/plan-import.ts` | `63bca2c8a7f265da69fd03c8a455b7d10827cce1f702ca906efbd4a8cbc00b08` |
| `scripts/import-vocabulary.ts` | `660faf1e2bc8f1502249a998ed9ef15caeb644a807d56192d48e6f46a9109a84` |

Gate B must run the importer from the reviewed PR head. A later
commit that changes importer sources invalidates this identity.

## 2. Empty-target preflight

Reconfirm Dedicated identity first. Do not use the local CLI
legacy link. This planning pass designed the checks; it did not
run catalog SQL.

### 2.1 Evidence classes

| Class | Meaning |
| --- | --- |
| `TARGET_OBJECTS_NOT_EXPOSED_OR_NOT_FOUND` | PostgREST `PGRST205` / schema-cache miss on named tables. Auxiliary. Not catalog proof. |
| `TARGET_EMPTY_CATALOG_VERIFIED` | Authorized read-only catalog queries proved REQUIRED_CORE tables absent, shared Blaze objects absent, conflicting functions/triggers/indexes absent, and migration history absent or empty. |

Gate A remains blocked until `TARGET_EMPTY_CATALOG_VERIFIED`.

Catalog channel, when later authorized: `supabase db query` with
`--db-url` pointing at the Dedicated-only connection from the
Gate B-style isolated snapshot. Never `--linked`. Never
`.env.local`. Print only pass/fail classes, never the connection
string.

### 2.2 Required catalog judges

| Check | Read-only judge | Pass before Gate A | Stop |
| --- | --- | --- | --- |
| REQUIRED_CORE tables | `pg_class` / `information_schema.tables` | absent | any required table exists |
| Shared objects | campus / enrollment / newsletter / traffic / `public.users` / Blaze-named functions | absent | any present |
| Conflicting objects | `pg_trigger` / `pg_proc` / `pg_indexes` for V0 names and collisions | absent | same names or unexpected extras |
| Migration history | `supabase_migrations.schema_migrations` if the schema exists | **history precondition**: table missing or zero rows. No Blaze versions. | any row, fabricated Blaze versions, or a version that is not `202609260001` after a later apply |
| Extensions | `pg_extension` for `pgcrypto` | missing is OK before Gate A | missing after a successful Gate A |
| Roles | `pg_roles` for `anon`, `authenticated`, `service_role` | all three exist | any missing |

Learner and vocabulary row counts are catalog checks only after
those tables exist. Before Gate A they must be absent, not empty.

### 2.3 Stop conditions

Do not enter Gate A if any of these is true:

1. Catalog is not `TARGET_EMPTY_CATALOG_VERIFIED`.
2. Any REQUIRED_CORE table already exists.
3. Any learner table has data (once tables exist).
4. Vocabulary is partially imported.
5. Shared Blaze objects appear on the Dedicated target.
6. Dedicated target identity is not `DEDICATED_TARGET_MATCH`.
7. Baseline SHA-256, PR head, or vocabulary fingerprint drifted
   from section 1.
8. The service-role server path cannot be confirmed.
9. Production alias has left `782ffcc`.
10. The operator would use the legacy CLI link.
11. `migration repair`, Dashboard apply, or `db query --file` of
    the baseline without a proven history insert in the **same**
    transaction is the proposed method.
12. Schema objects and history would not be proven to commit or
    roll back together.
13. Unauthorized `db push` / `migration up` (including
    `--linked`).

## 3. Migration history investigation

Observed CLI: **2.118.0** (`npx supabase`). Commands that exist:

| Command | Proven facts from `--help` / docs this pass |
| --- | --- |
| `supabase db push` | Pushes pending files in `supabase/migrations/` to a remote. `--db-url` targets an explicit connection. `--linked` uses the current CLI link. `--dry-run` lists without applying. `--include-all` includes local files missing from remote history. First successful remote push creates `supabase_migrations.schema_migrations` and inserts a row after a migration applies. |
| `supabase migration up` | Help text says it applies pending migrations to the **local** database; it also accepts `--db-url` / `--linked`. Not selected. |
| `supabase migration list` | Lists local vs remote versions. `--db-url` or `--linked`. |
| `supabase migration repair` | Mutates history without running SQL (`applied` / `reverted`). **Forbidden.** |
| `supabase db query` | Executes SQL. `--file` can run the baseline without recording history. **Not** an apply channel. `--linked` forbidden. |

Active lineage has **one** file. Archive files live in
`supabase/migrations_archive/pre_dedicated_baseline/` and are not
CLI migrations. A future Dedicated-only `db push` would not replay
them.

Rejected channels:

- Dashboard SQL Editor: applies SQL and does **not** write
  `schema_migrations`. The baseline would never become a real
  history start. Not recommended. Not authorized.
- Dashboard apply then `migration repair`: disguises already-run
  SQL as a CLI apply. Forbidden.
- `db query --file` then a later history insert: same split.
  Forbidden.
- `db push --linked` or any command on the current CLI link:
  that link is the legacy source. Forbidden.

Candidate that was evaluated and **not proven safe**:
`supabase db push --db-url` to a Dedicated-only connection, after
`--dry-run` shows only `202609260001_dedicated_wordranger_baseline_v0`.

Why it is not proven:

1. The baseline file contains authored `begin;` / `commit;`.
2. CLI 2.118.0 inserts
   `supabase_migrations.schema_migrations(version, name, statements)`
   **after** the file statements. Official text: after successfully
   applying a migration, a new row is inserted.
3. A file-level `commit` therefore ends the schema transaction
   before the history insert. Schema and history are not proven
   to be one transaction.
4. Files with authored transaction control are applied
   sequentially, not inside the CLI batch transaction that
   otherwise wraps statement batches.
5. Failure after schema commit and before history insert would
   leave objects without a `202609260001` row. That is a
   schema/history mismatch. This plan cannot accept that
   half-state.

Therefore no real feasible apply channel is selected.
**Gate A is BLOCKED. Remote apply is not authorized.**

### 3.1 History contract (required once a later review unblocks Gate A)

| Item | Requirement |
| --- | --- |
| Version | `202609260001` |
| History precondition | `supabase_migrations.schema_migrations` missing or zero rows. No Blaze versions. |
| History postcondition | exactly one row: version `202609260001`, name `dedicated_wordranger_baseline_v0`. No other versions. |
| Schema postcondition | REQUIRED_CORE objects match the exact baseline SHA. |
| Mismatch stop | objects without that row, that row without objects, extra versions, or archive versions. Stop. Do not repair. |
| Next migration | only after this postcondition. A later reviewed file in `supabase/migrations/` may then be discussed. Archive files stay out of the active directory. |
| When `db push` may be discussed | only after a later review proves schema statements and the history insert commit or roll back together on Dedicated, catalog is `TARGET_EMPTY_CATALOG_VERIFIED`, `--db-url` is Dedicated-only, `--linked` is not used, `--dry-run` lists only this baseline, and `--include-all` / `--include-seed` / `--include-roles` are off. That discussion is a new authorization. It is not granted here. |

## 4. Apply runbook — not executed

Gates are sequential: **Gate A → Gate B → Gate C → Gate D**.
Later gates are forbidden until earlier gates have written
evidence. No gate is authorized by this document. Because Gate A
is blocked, Gates B–D remain unauthorized.

### Gate A — baseline apply — BLOCKED

Dedicated target only. Exact reviewed file. Exact SHA. Only the
active baseline. No archive replay. No Blaze history. No
Dashboard channel. No history repair.

Required later, and not met now:

1. `TARGET_EMPTY_CATALOG_VERIFIED`.
2. A proven channel where schema and history postconditions
   succeed together, or the entire attempt rolls back to the
   history precondition plus absent REQUIRED_CORE tables.
3. Recomputed baseline SHA-256 equals section 1.
4. Catalog post-check plus history postcondition in the same
   authorization window.
5. Schema/history mismatch is a stop. Do not `migration repair`.

Do not apply while this gate is blocked.

### Gate B — vocabulary seed

Only after Gate A catalog **and** history postconditions passed.

Credential-source contract (static; not a secret):

1. Do not read or mix workspace `.env.local`.
2. Do not use the current legacy CLI link.
3. Pull Production env from the already-authorized linked Vercel
   project into a gitignored temp file, or use another
   explicitly approved Dedicated-only credential source.
4. Temp path must be outside the git work tree.
5. Do not print URL, host, ref, key, token, or value.
6. In memory, verify: URL host is the already-checked Dedicated
   target; the service-role key is from the **same** Dedicated-only
   snapshot; required variable names are present; the snapshot
   omits the anon key so the importer cannot use anon fallback.
7. The importer process may read only that isolated snapshot.
8. Ambient env and `.env.local` must not override it. Start from
   a clean environment and pass only the isolated names.
9. After success or failure, delete the temp file and record
   `TEMP_DELETED`.
10. Re-verify target identity before and after apply.
11. If the live importer client cannot be proven to point at
    Dedicated, Gate B stops.

Importer steps after credentials pass:

1. Confirm PR head identity.
2. `npm run import:vocabulary -- --fingerprint` matches section 1.
3. `--validate` / `--dry-run` stay offline.
4. Vocabulary and learner catalog counts still zero.
5. `--apply` is empty-target seed plus deterministic upsert. No
   stale-row delete. No learner writes.
6. Read back imported columns and recompute
   `vocabulary-content-v1`. Mismatch is a stop.

`scripts/import-vocabulary.ts` uses `createSupabaseServerClient`,
which can fall back to anon. The isolated snapshot must therefore
contain `SUPABASE_SERVICE_ROLE_KEY` and must not contain an anon
key. Name presence alone is not enough; host and key must come
from the same Dedicated-only snapshot.

### Gate C — no-write runtime and security preflight

Only after Gate A catalog and history postconditions and Gate B
fingerprint all passed.

Gate C is **no-write**:

- service-role read-only counts (vocabulary matches section 1;
  learner counts zero)
- anon / authenticated denied on learner and vocabulary tables
- adapter/config validation only
- do not create session, task, or evidence
- do not mint a disposable user identity
- do not claim Evidence can be deleted
- `learning_evidence` is append-only; `service_role` cannot
  DELETE it; `cleanup_progress_test_user` is not in V0
- do not add a cleanup RPC or test-only migration

A real `/train` write smoke is **not** Gate C. It moves to Gate D
as a separately authorized step.

### Gate D — PR merge / Production deployment

Only after Gates A, B, and C have complete evidence.

1. Merging PR #17 is a **separate authorization**. Automatic Git
   deployments are `ENABLED`. This plan does not merge. No
   automatic PR merge.
2. Before any such merge, reconfirm Production env still
   `POINTS_TO_DEDICATED_TARGET` and the alias is still `782ffcc`
   until the new deploy is accepted.
3. After a separately authorized merge/deploy: unauthenticated
   GET `/`, `/train`, `/practice` (expect 404), Context Lab
   (expect 404). No writes.
4. `/train` write smoke is a **further** authorization after
   those GETs. It uses the existing `/train` identity contract
   (`V1_PLACEHOLDER_USER_ID`). Evidence written there is
   append-only deployment evidence. This plan does not promise
   deletion. Before writes, record before/after learner counts.
   Duplicate or refresh must show only the expected Evidence
   increment. If permanent canary Evidence is not accepted, do
   not run the write smoke.
5. Keep `782ffcc` as the instant rollback until the new
   Production deploy is accepted.
6. Do not enable `/practice`, Auth, or Context Lab with this
   merge.

## 5. Rollback matrix

| Case | Action |
| --- | --- |
| Gate A still blocked | Do nothing remote. Do not apply. |
| A later Gate A attempt fails with schema and history still at precondition | Remain empty. Re-review. |
| Schema objects exist without history postcondition, or the reverse | **Mismatch stop.** Do not repair history. Do not re-apply. Human decision. |
| Gate A later succeeded, Gate B failed | Keep schema and honest history. Do not open runtime. Do not merge. Rerun deterministic seed after fix. |
| Gate B succeeded, Gate C failed | Do not delete vocabulary. Do not merge PR #17. Investigate adapter/config. |
| Production deployment failed or is unsafe | Instant rollback to `782ffcc`. |
| Learner writes already exist on Dedicated | Stop writes. Do not overwrite, truncate, or rebuild. Evidence is append-only. Human decision. |

Do not migrate learner data from the legacy source. Do not copy
shared Blaze objects. Do not use covering rebuild as rollback.

## 6. Explicit non-claims

- Baseline was not applied
- Vocabulary was not imported
- PR #17 was not merged
- No `db push` / `migration up` / history repair
- Dashboard SQL Editor is not the recommended apply channel
- No Vercel env edit
- No Production deployment from this plan
- `/train` was not Started
- Gate C writes no learner data
- `/practice`, Auth, and Context Lab stay disabled
- No Blaze access or write
- No automatic PR merge
