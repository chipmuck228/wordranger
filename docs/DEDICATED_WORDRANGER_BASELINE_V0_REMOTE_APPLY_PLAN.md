# Dedicated WordRanger Baseline V0 Remote Apply Plan

Candidate / Not a Standard. **Read-only plan. Nothing below is authorized
or executed by this document.**

- Date: **2026-09-26**
- `origin/main`: `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- PR: **#17** remains OPEN and unmerged
- PR head: `bb6e522e4db350ca915dade672cbed786f6a7bd1`
- Branch: `migration/dedicated-wordranger-baseline-candidate-v0`
- Production alias remains the known-good `782ffcca670c` rollback
- Active baseline:
  `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql`
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
| Dedicated schema | `TARGET_EMPTY` |
| Shared Blaze objects on Dedicated | absent (`PGRST205` on campus / enrollment / newsletter / traffic / `public.users`) |
| Production `SUPABASE_SERVICE_ROLE_KEY` name | present |
| Local CLI link | legacy source, **not** the Dedicated target. Do not apply through it. |

`FREE_PRACTICE_ENABLED`, `FREE_PRACTICE_RUNTIME`, and
`CONTEXT_LAB_ENABLED` remain unset on Production.

If any later check disagrees with this table, stop. Do not use the
Gate A–D instructions below.

## 1. Immutable deployment identity

These values are the authorization inputs. Any SHA or fingerprint
change requires a new review. Do not apply a drifted tree.

| Input | Value |
| --- | --- |
| PR head | `bb6e522e4db350ca915dade672cbed786f6a7bd1` |
| Active baseline path | `supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql` |
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

Run these as **read-only** queries on the Dedicated target that
Production names already point to. Reconfirm identity first. Do not
run them against the local CLI legacy link. This planning pass
designed the checks; it did not apply SQL.

### 2.1 Required queries and judges

| Check | Read-only judge | Pass | Stop |
| --- | --- | --- | --- |
| Extensions | `pg_extension` for `pgcrypto` | missing is OK before Gate A; required after Gate A | unexpected extra WordRanger extensions are not a stop; missing `pgcrypto` after Gate A is a stop |
| REQUIRED_CORE tables | `pg_class` / `information_schema.tables` for the ten V0 tables | **absent** before Gate A | any required table exists with unexpected columns, constraints, or a partial create |
| Migration history | `supabase_migrations.schema_migrations` if the schema exists; otherwise treat as missing | empty or missing before Gate A | fabricated Blaze versions, or a baseline version that is not this file |
| Learner rows | `count(*)` on the six learner tables after they exist; before Gate A, table-absent (`PGRST205`) is the empty proof | zero / absent | any learner row |
| Vocabulary rows | `count(*)` on the four vocabulary tables after they exist; before Gate A, `PGRST205` is the empty proof | zero / absent | any vocabulary row before Gate B, or a partial import |
| Trigger / function / index | `pg_trigger` / `pg_proc` / `pg_indexes` for `learning_evidence_no_update`, `prevent_learning_evidence_mutation`, and V0 index names | absent before Gate A; exact V0 names after Gate A | same names with different definitions, or unexpected extras that collide |
| Shared objects | campus / enrollment / newsletter / traffic / `public.users` / Blaze-named functions | absent | any present on Dedicated |
| Roles | `pg_roles` for `anon`, `authenticated`, `service_role` | all three exist | any missing |
| Service-role server path | Vercel Production name `SUPABASE_SERVICE_ROLE_KEY` present; importer must not fall back to anon | name present and Dedicated host still matches | name missing, or Production host no longer Dedicated |
| Target vs Production identity | Production URL host equals the Dedicated target, and is not the legacy source | `DEDICATED_TARGET_MATCH` | `MISMATCH` or `NOT_VERIFIED` |

`PGRST205` on a `select=id&limit=0` probe remains a valid
before-Gate-A emptiness proof. A `200` with rows is data drift. A
`200` with zero rows after an unexpected prior apply is schema
drift: stop and re-review; do not apply this baseline on top.

### 2.2 Stop conditions

Do not enter Gate A if any of these is true:

1. Any REQUIRED_CORE table already exists with unexpected structure.
2. Any learner table has data.
3. Vocabulary is partially imported (some rows, count/fingerprint
   mismatch, or only some of the four tables present).
4. Shared Blaze objects appear on the Dedicated target.
5. Dedicated target identity is not `DEDICATED_TARGET_MATCH`.
6. Baseline SHA-256, PR head, or vocabulary fingerprint drifted
   from section 1.
7. The service-role server path cannot be confirmed.
8. Production alias has left `782ffcc`.
9. The operator is connected to the legacy CLI link rather than
   Dedicated.
10. `db push`, `migration up`, or history repair is the proposed
    apply method.

## 3. Apply runbook — not executed

Gates are sequential. Later gates are forbidden until earlier gates
have written evidence. No gate is authorized by this document.

### Gate A — baseline apply

Dedicated target only. Exact reviewed file. Single transaction.
Do not edit the SQL. Do not `db push`. Do not insert or repair
`schema_migrations` rows.

1. Recompute baseline SHA-256. It must equal section 1.
2. Re-run section 2 preflight. All stop conditions must be false.
3. Apply the exact file in one transaction (the file already wraps
   `begin` / `commit`). Dashboard SQL Editor on Dedicated is the
   intended path. The current local CLI link is the legacy source
   and must not receive this file.
4. Immediate catalog post-check:
   - ten REQUIRED_CORE tables exist with V0 columns / FKs / checks
   - `pgcrypto` exists
   - `learning_evidence_no_update` and
     `prevent_learning_evidence_mutation` exist
   - learner RLS ENABLE, FORCE off, zero policies
   - vocabulary: `REVOKE ALL` from PUBLIC / anon / authenticated /
     `service_role`, then `GRANT SELECT, INSERT, UPDATE` only
   - learner: `GRANT SELECT, INSERT, UPDATE, DELETE` to
     `service_role`; client roles revoked
   - `cleanup_progress_test_user` absent
   - shared Blaze names absent
   - learner and vocabulary row counts remain zero
5. Record whether the transaction committed. If it failed, record
   whether the entire transaction rolled back. A partial object
   set is a stop, not a retry-without-review.
6. Honest history: Dashboard apply does not invent Blaze versions
   and does not require a repaired CLI history. History may remain
   missing. That is not authorization to `db push`.

### Gate B — vocabulary seed

Only after Gate A catalog post-check passed.

1. Confirm PR head is still `bb6e522e4db350ca915dade672cbed786f6a7bd1`
   or a later reviewed SHA that replaced this identity.
2. Run `npm run import:vocabulary -- --fingerprint` from that tree.
   `algorithmVersion`, fingerprint, and the four counts must match
   section 1.
3. `--validate` / `--dry-run` remain offline. They do not write.
4. Confirm Dedicated vocabulary counts are still zero and learner
   counts are still zero.
5. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set for the apply process.
   `scripts/import-vocabulary.ts` uses `createSupabaseServerClient`,
   which can fall back to the anon key. Anon must not be the apply
   path. Missing service-role is a stop.
6. `--apply` is empty-target seed plus deterministic upsert. It
   does not delete stale rows. It does not write learner tables.
7. Read back every imported business column through
   `toVocabularyImportRows()` / the same column set used by the
   isolated PGlite seed test. Recompute
   `vocabulary-content-v1`. `assertVocabularySeedMatches` against
   section 1. Count mismatch or fingerprint mismatch is a stop.
8. Learner tables must still be empty.

### Gate C — runtime read/write smoke

Only after Gate A catalog and Gate B fingerprint both passed.

1. Service-role read-only: SELECT counts on vocabulary match
   section 1; learner counts remain zero.
2. Anon and authenticated must be denied on learner and vocabulary
   tables.
3. Do not mint learning data under the production placeholder
   identity. Do not Start `/train` as a casual probe.
4. Smoke identity, if later authorized: one disposable user UUID
   created only for this smoke, never `V1_PLACEHOLDER_USER_ID`,
   never a real student. Writes limited to learner tables. Cleanup
   is an authorized service-role delete of that UUID only.
   `cleanup_progress_test_user` is not in V0 and must not be added
   to do this.
5. This planning pass does not execute smoke and does not mint
   that identity.

### Gate D — PR merge / Production deployment

Only after Gates A, B, and C have complete evidence.

1. Merging PR #17 is a **separate authorization**. Automatic Git
   deployments are `ENABLED`; a merge to `main` will trigger a
   Production deployment. This plan does not merge.
2. Immediately before any such merge, reconfirm Production env
   still `POINTS_TO_DEDICATED_TARGET` and the alias is still
   `782ffcc` until the new deploy is accepted.
3. After a separately authorized merge/deploy: unauthenticated GET
   `/`, `/train`, `/practice` (expect 404), Context Lab (expect
   404). No writes.
4. `/train` Start smoke needs another authorization after those
   GETs. Keep `782ffcc` as the instant rollback until the new
   Production deploy is accepted.
5. Do not enable `/practice`, Auth, or Context Lab with this merge.

## 4. Rollback matrix

| Case | Action |
| --- | --- |
| Gate A fails inside the transaction | Rollback the transaction. Do not retry a partial apply. Re-review the error. Dedicated must return to `TARGET_EMPTY` before another Gate A. |
| Gate A committed, Gate B failed | Keep the schema. Do not open runtime. Do not merge. Fix the importer/process, reconfirm empty-or-deterministic upsert, and rerun Gate B only. Do not drop/rebuild tables to hide a seed error. |
| Gate B succeeded, Gate C failed | Do not delete vocabulary. Do not merge PR #17. Investigate adapter/config/grants. No overwrite rebuild. |
| Production deployment failed or is unsafe | Instant rollback to `782ffcc`. Do not treat Preview as Production. |
| Learner writes already exist on Dedicated | Stop writes. Do not overwrite, truncate, or rebuild to roll back. Human decision required. Dedicated history is now live. |

Do not migrate learner data from the legacy source. Do not copy
shared Blaze objects. Do not use covering rebuild as rollback.

## 5. Explicit non-claims

- Baseline was not applied
- Vocabulary was not imported
- PR #17 was not merged
- No `db push` / `migration up` / history repair
- No Vercel env edit
- No Production deployment from this plan
- `/train` was not Started
- `/practice`, Auth, and Context Lab stay disabled
- No Blaze access or write
- No automatic PR merge
