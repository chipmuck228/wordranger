# Dedicated WordRanger Consolidated Baseline Candidate V0

Candidate / Not a Standard. **Local authoring and isolated validation only.**

- Date: **2026-09-26**
- Base: `origin/main` @ `a031be4ba791af9ac68aad93e8aba9f3437128cf`
- Branch: `migration/dedicated-wordranger-baseline-candidate-v0`
- Production alias remains the known-good `782ffcca670c` rollback
- This branch is **local only**. Do not push. Do not open a PR.
- No remote Dedicated apply. No Blaze write. No Vercel env edit.
- `db push` / `migration up` / history repair remain **forbidden**.

## 0. Work contract

Read and obey `docs/CURSOR_WORKING_CONTRACT.md`. This task does not
change frozen Core, Scheduler, TaskEvaluator, Homepage, `/practice`,
or Auth.

Student-path vocabulary remains the bundled dataset. Baseline tables
exist so Evidence / task FKs and the admin rebuild importer have a
schema. Production `/train` adapters still read bundled vocabulary.

## 1. Phase 0 matrix

| Class | Objects |
| --- | --- |
| REQUIRED_CORE | `vocabulary_source_entries`, `lexemes`, `lexeme_relations`, `lexeme_tags`, `learning_tasks`, `game_sessions` plus `revision`, `learning_evidence` with session correlation and unique `task_id`, `student_lexeme_models`, `student_lexeme_skill_states`, `student_lexeme_weaknesses`, append-only trigger, `pgcrypto`, current PK/FK/unique/index/check contracts |
| REQUIRED_SERVER_SECURITY | RLS ENABLE not FORCE on the six learner tables; PUBLIC / anon / authenticated revoke; `service_role` SELECT/INSERT/UPDATE/DELETE |
| REBUILD_FROM_REPO | Vocabulary rows via the existing importer + rebuild fingerprint. No learner rows. |
| OPTIONAL_EXPERIMENTAL | `vocabulary_placement_reviews`, Context Lab, contextual-content objects. Not in V0. |
| TEST_ONLY_EXCLUDED | `cleanup_progress_test_user` |
| SHARED_BLAZE_EXCLUDED | campus / enrollment / newsletter / traffic / `public.users` / Blaze-named functions / Blaze history |
| OBSOLETE/UNUSED | `learning_sessions` leftover stub. V0 never creates it and never restores the old Evidence session FK. |

No Candidate inventory gap was found. `/train`, free-play, Free
Practice persistence, and Scheduler query ports use the required
core tables only. They do not require placement reviews or Context
Lab objects.

## 2. Active lineage

Historical twelve files were Git-moved to:

`supabase/migrations_archive/pre_dedicated_baseline/`

That folder is **not** an active CLI migration directory.

Active file:

`supabase/migrations/202609260001_dedicated_wordranger_baseline_v0.sql`

The SQL is a single empty-database create. It is not idempotent.
A migration runner must not re-apply the same version. A second
apply is expected to fail with already-exists.

No Blaze `schema_migrations` rows were invented.

## 3. Vocabulary rebuild

Reuse `npm run import:vocabulary`. Added `--fingerprint` prints
counts and a SHA-256 of sorted bundled canonical keys. That mode
does not open a database.

`--validate` / `--dry-run` remain offline. `--apply` still requires
an explicit later authorization and is not used by this Candidate.

Rebuild writes only vocabulary tables. It does not write Evidence,
snapshots, sessions, or Scheduler state.

## 4. Isolated validation

No local `psql`, Docker, or Supabase CLI. Isolated apply uses the
already-installed PGlite engine.

PGlite does not package `pgcrypto`. The isolated harness skips that
one statement because `gen_random_uuid` is built-in. Real empty
Postgres / Supabase still apply the committed extension line.

Verified in isolation:

- one apply succeeds
- second apply fails already-exists
- required tables / trigger / indexes exist
- shared Blaze and cleanup RPC absent
- learner RLS on, FORCE off, zero policies
- PUBLIC / anon / authenticated have no learner DML
- `service_role` has the six-table DML grants
- Evidence append-only
- bundled vocabulary rebuild counts and fingerprint match
- zero learner rows after rebuild

Remote Dedicated target was not contacted. Production remains on
`782ffcca670c`.

## 5. Explicit non-claims

- Not remotely applied
- Not a Vercel cutover
- Not production-ready
- `/practice` stays disabled
- Context Lab stays disabled
- Auth stays disabled
- Learner history is not migrated
- Frozen learning semantics are unchanged
