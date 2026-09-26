# Dedicated WordRanger Supabase Object Inventory

Candidate / Not a Standard. **Design inventory only.**

Base: `origin/main` @ `782ffcca670c8272a3ba7ca07bedaef4debdc95f`.

Companion to `docs/DEDICATED_WORDRANGER_SUPABASE_MIGRATION_CANDIDATE.md`.
No remote DDL/DML. No learner-row export. No secrets.

Catalog sources:

- Repository migrations and adapters (this pass)
- Authorized Blaze catalogs already recorded in Free Practice inventory,
  security apply-evidence, and anonymous-auth preflight
- Dedicated-target existence probes (`select=id` `limit=0` only)
  during the emergency check and the first design pass

This revision did not re-run Management API catalog, env pull, or
SQL. Blaze column/index/RLS facts remain those prior catalogs plus
repository SQL. Dedicated-target emptiness is the last verified
classification (`TARGET_EMPTY`); no DDL/DML was performed.

The design branch **has been pushed**. That commit triggered one
Vercel Preview (Ready). Production was not redeployed. `main` was
not merged. Vercel env was not edited.

`/practice` remains disabled. This inventory does not enable it.

## 1. Identity

| Side | Classification |
| --- | --- |
| Legacy source | `LEGACY_SOURCE_MATCH` (CLI name `blaze`) |
| Dedicated target | `DEDICATED_TARGET_MATCH` (`TARGET_EMPTY`) |
| Vercel Development | `NOT_CONFIGURED` |
| Vercel Preview configuration | `POINTS_TO_DEDICATED_TARGET` |
| Vercel Production configuration | `POINTS_TO_DEDICATED_TARGET` |
| Active production snapshot | `ACTIVE_PRODUCTION_TARGET_NOT_VERIFIED` |
| Design-branch Preview | occurred (not a runtime acceptance) |
| Production redeploy | none |
| Active migration lineage (future) | one consolidated baseline; twelve current files must leave `supabase/migrations/` |

## 2. Repository migrations in order

All files are WordRanger-owned. None reference shared Blaze tables.
None are automatically authorized to apply. A later baseline task
must move all twelve out of active `supabase/migrations/` before
the consolidated baseline becomes the only active file. This
revision does not move them.

### `202609160001_vocabulary_domain.sql`

- Creates: `pgcrypto` extension; tables `vocabulary_source_entries`,
  `lexemes`, `lexeme_relations`, `lexeme_tags`, `learning_sessions`,
  `student_lexeme_models`, `student_lexeme_skill_states`,
  `student_lexeme_weaknesses`, `learning_evidence`
- Function / trigger: `prevent_learning_evidence_mutation` /
  `learning_evidence_no_update` (BEFORE UPDATE OR DELETE)
- Indexes: lexeme lemma / source; snapshot user / lexeme / review;
  evidence user+lexeme+time, session, skill, outcome
- Checks: mastery and confidence ranges; evidence outcomes;
  independent/assisted hint-count invariant
- FK: lexemes → source entries; relations/tags/evidence/snapshots →
  lexemes; skill states / weaknesses → models
- Original `learning_evidence.session_id` FK → `learning_sessions`
  (later dropped)
- Idempotent: `create table/index/extension if not exists`; trigger
  dropped then recreated
- Destructive: none
- Test-only: no
- Assumes existing objects: no
- Depends on imported vocabulary: no (schema only)
- Class: `TARGET_BASELINE_REQUIRED`
- Blaze: objects present (inference). History absent.

### `202609160002_learning_tasks.sql`

- Alters: `lexeme_tags` confidence range checks
- Creates: `learning_tasks` + indexes
- Alters: `learning_evidence.task_id` FK + partial unique index
- Idempotent: `if not exists` on table/index/column; CHECK add is
  not guarded and can fail if re-run
- Destructive: none
- Assumes: `lexeme_tags` and `learning_evidence` exist
- Class: `TARGET_BASELINE_REQUIRED`
- Blaze: objects present

### `202609170001_game_sessions.sql`

- Creates: `game_sessions` + user / game_type / updated_at indexes
- Idempotent: `if not exists`
- Class: `TARGET_BASELINE_REQUIRED`
- Blaze: objects present

### `202609170002_game_sessions_revision.sql`

- Adds `revision bigint not null default 0` and nonnegative check
- Idempotent: `add column if not exists`; drop/add check
- Assumes: `game_sessions` exists
- Class: `TARGET_BASELINE_REQUIRED`
- Blaze: `revision` present

### `202609170003_learning_evidence_session_correlation.sql`

- Drops `learning_evidence_session_id_fkey` if exists
- Idempotent: drop if exists
- Destructive: constraint drop only (required; the FK blocked
  `game_sessions.id` correlation)
- Class: `TARGET_BASELINE_REQUIRED`
- Blaze: no session_id FK (consistent)

### `202609170004_cleanup_progress_test_user.sql`

- Creates SECURITY DEFINER RPC that deletes one non-placeholder
  test user across weaknesses, skill states, evidence, models,
  tasks, sessions
- Refuses `V1_PLACEHOLDER_USER_ID`
- Uses transaction-local replica role; does not drop the append-only
  trigger
- Grants: execute to `service_role` only
- Test-only: **yes**
- Class: `TARGET_TEST_ONLY`
- Dedicated **production** baseline: **exclude**. Do not copy this
  RPC onto the production target. Production smoke must not use it.
- Later cleanup, if needed: separate test project, or a separately
  authorized test-only migration
- Blaze: **ABSENT** (repo file never applied)
- Would succeed on empty project only after learner tables exist

### `202609170005_vocabulary_placement_reviews.sql`

- Creates curated placement overlay table, indexes, RLS, revoke
  client roles, grant service_role SELECT/INSERT/UPDATE
- Depends on `lexemes`
- Does not require imported rows
- Class: `TARGET_OPTIONAL_EXPERIMENTAL` until a contract lets
  Scheduler read it
- Blaze: **ABSENT**

### `202609200001_context_lab_runs.sql`

- Experimental run orchestration table, RLS, service_role only
- Class: `TARGET_OPTIONAL_EXPERIMENTAL`
- Blaze: objects present
- Not required for `/train`

### `202609220001_contextual_content_releases.sql`

- Experimental release drafts; RLS; service_role DML including DELETE
- Class: `TARGET_OPTIONAL_EXPERIMENTAL`
- Blaze: objects present
- Not required for `/train`

### `202609220002_contextual_content_active_releases.sql`

- Alters release lifecycle columns; pointer table; helper function;
  publish / rollback SECURITY DEFINER RPCs
- Header originally said committed-only; Blaze later has the objects
- Assumes `contextual_content_releases` exists
- Class: `TARGET_OPTIONAL_EXPERIMENTAL`
- Blaze: objects present
- Not required for `/train`

### `202609220003_contextual_content_batch_promotions.sql`

- Batch promotion table + `promote_contextual_content_batch`
  SECURITY DEFINER RPC
- Class: `TARGET_OPTIONAL_EXPERIMENTAL`
- Blaze: objects present
- Not required for `/train`

### `202609250001_learner_table_server_only_access.sql`

- `begin` / `commit`
- ENABLE RLS (not FORCE) on six `public` learner tables
- Revoke PUBLIC / anon / authenticated; grant service_role DML
- Explicit table list only. Comments forbid touching campus /
  enrollment / newsletter / other shared Blaze objects
- Assumes the six tables exist (ALTER, not CREATE)
- Idempotent enough for a second ENABLE/REVOKE; not a create
- Destructive: privilege revoke only
- Dashboard-applied on Blaze. History **not** written
- SHA-256 remains pinned in apply-evidence docs
- Class: `TARGET_BASELINE_REQUIRED`
- Empty-project apply: only after the create migrations

## 3. WordRanger-owned objects

### Required for `/train` production runtime

| Object | Kind | Class |
| --- | --- | --- |
| `public.vocabulary_source_entries` | table | `WORDRANGER_REQUIRED` |
| `public.lexemes` | table | `WORDRANGER_REQUIRED` |
| `public.lexeme_relations` | table | `WORDRANGER_REQUIRED` |
| `public.lexeme_tags` | table | `WORDRANGER_REQUIRED` |
| `public.learning_tasks` | table | `WORDRANGER_REQUIRED` |
| `public.learning_evidence` | table | `WORDRANGER_REQUIRED` |
| `public.student_lexeme_models` | table | `WORDRANGER_REQUIRED` |
| `public.student_lexeme_skill_states` | table | `WORDRANGER_REQUIRED` |
| `public.student_lexeme_weaknesses` | table | `WORDRANGER_REQUIRED` |
| `public.game_sessions` | table | `WORDRANGER_REQUIRED` |
| `prevent_learning_evidence_mutation` | function | `WORDRANGER_REQUIRED` |
| `learning_evidence_no_update` | trigger | `WORDRANGER_REQUIRED` |
| Learner-table RLS ENABLE + client revoke | grants/RLS | `WORDRANGER_REQUIRED` |
| `pgcrypto` | extension | `WORDRANGER_REQUIRED` |

`learning_sessions` is created by the first file and is a leftover
stub. Class: `WORDRANGER_REQUIRED` as an empty table if the first
file is replayed, or omit only inside a reviewed baseline that never
creates the FK. **Do not migrate rows.**

### Optional / experimental

| Object | Class |
| --- | --- |
| `vocabulary_placement_reviews` | `WORDRANGER_EXPERIMENTAL` |
| `context_lab_runs` | `WORDRANGER_EXPERIMENTAL` |
| `contextual_content_releases` | `WORDRANGER_EXPERIMENTAL` |
| `contextual_content_active_release_pointers` | `WORDRANGER_EXPERIMENTAL` |
| `contextual_content_batch_promotions` | `WORDRANGER_EXPERIMENTAL` |
| `publish_contextual_content_release` | `WORDRANGER_EXPERIMENTAL` |
| `rollback_contextual_content_active_release` | `WORDRANGER_EXPERIMENTAL` |
| `contextual_content_release_row_manifest_consistent` | `WORDRANGER_EXPERIMENTAL` |
| `promote_contextual_content_batch` | `WORDRANGER_EXPERIMENTAL` |

### Test-only

| Object | Class |
| --- | --- |
| `cleanup_progress_test_user` | `WORDRANGER_TEST_ONLY` (not in Dedicated production baseline) |

### Not used by WordRanger

- Supabase Storage buckets: **none referenced** (browser
  `sessionStorage` / `localStorage` only)
- Views: none in repo migrations
- Sequences: none required (uuid keys; `gen_random_uuid` defaults)

## 4. Blaze source catalog (WordRanger subset)

Prior authorized catalog. No learner row contents.

| Topic | Blaze |
| --- | --- |
| `public` WordRanger runtime tables listed above except placement reviews | present |
| `vocabulary_placement_reviews` | absent |
| `cleanup_progress_test_user` | absent |
| `learning_evidence` append-only trigger | present |
| `game_sessions.revision` | present |
| `learning_evidence.session_id` FK | absent (dropped) |
| `learning_evidence.task_id` partial unique | present |
| Six learner tables RLS | ENABLE, FORCE off, zero policies (after Dashboard apply) |
| Six learner tables client grants | revoked; service_role DML kept |
| `supabase_migrations.schema_migrations` | absent |
| Management API migration list | empty |
| Auth | email enabled; Anonymous Sign-In disabled; CAPTCHA none; Auth user count 0 |
| Storage WordRanger buckets | none |

Shared Blaze surface (do **not** copy):

- campus / enrollment / newsletter / traffic tables (15 named
  `public` tables counted in the auth preflight, including
  `public.v3_migration_offering_legacy_stage`)
- `public.users` with RLS and `auth.uid()` policies
- functions whose names include `blaze`
- platform `auth` / `realtime` / `storage` migration tables

Class for all of those: `SHARED_BLAZE_DO_NOT_COPY`.

## 5. Dedicated target catalog

Recheck this pass: `lexemes` existence probe HTTP 404 / schema-cache
miss. Emergency check: all sixteen WordRanger-named tables absent
(`PGRST205`). Auth health responded; project is live.

| Topic | Dedicated target |
| --- | --- |
| WordRanger tables | absent |
| WordRanger indexes / constraints / triggers / RPCs | absent (cannot exist without tables) |
| Shared Blaze objects | not copied (empty WordRanger surface) |
| Migration history | not created by this pass; treated as empty |
| Auth activation | not enabled by this pass; not claimed ready |
| Classification | `TARGET_EMPTY` |

## 6. Ownership and migration matrix

Row-count class uses the last authorized `/train` smoke on Blaze
(SMALL). Counts are not restated as exact identifiers.

| Dataset | Authority | Blaze rows | Rebuild repo? | Rebuild Evidence? | FK notes | Learner history? | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `vocabulary_source_entries` | bundled dataset | present | yes | no | none | no | `REBUILD_FROM_REPO` |
| `lexemes` | bundled dataset | present | yes | no | source entries | no | `REBUILD_FROM_REPO` |
| `lexeme_relations` | bundled dataset | present | yes | no | lexemes | no | `REBUILD_FROM_REPO` |
| `lexeme_tags` | bundled dataset | present | yes | no | lexemes | no | `REBUILD_FROM_REPO` |
| `vocabulary_placement_reviews` | curated JSON | absent | yes | no | lexemes | no | `REBUILD_FROM_REPO` if table included; else omit |
| `learning_tasks` | Blaze `/train` writes | SMALL | no | no | lexemes | placeholder + debug | `DO_NOT_MIGRATE` under Option 4; else `MIGRATE_REFERENTIAL_CLOSURE` |
| `learning_evidence` | Blaze `/train` writes | SMALL | no | n/a (is the log) | lexemes; optional task_id | placeholder + debug | `DO_NOT_MIGRATE` under Option 4; else `MIGRATE_EXACTLY` |
| `student_lexeme_models` | projection | SMALL | no | yes | lexemes | placeholder | `DO_NOT_MIGRATE` or `REPLAY_FROM_EVIDENCE` |
| `student_lexeme_skill_states` | projection | SMALL | no | yes | models | placeholder | same |
| `student_lexeme_weaknesses` | projection | SMALL | no | yes | models, optional lexeme | placeholder | same |
| `game_sessions` | orchestration | SMALL | no | no | none to evidence | placeholder | `DO_NOT_MIGRATE` under Option 4 |
| `learning_sessions` | stub | not treated as product data | n/a | no | leftover | no | `DO_NOT_MIGRATE` |
| `context_lab_runs` | experimental | not required | n/a | no | none | experimental | `DO_NOT_MIGRATE` |
| contextual-content tables | experimental | not required | n/a | no | each other | experimental | `DO_NOT_MIGRATE` |

Placeholder identity does **not** authorize disposal. Option 4 keeps
the rows on Blaze as the archive.

## 7. Adapters and scripts (env names only)

| Consumer | Names | Fail-closed |
| --- | --- | --- |
| Browser helper (unused by routes) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | returns null |
| SSR Auth reader | same two | session `NONE` |
| Student-game server client | URL + `SUPABASE_SERVICE_ROLE_KEY` ?? anon | runtime throw on Start |
| Service-role client | URL + service role only | null / throw |
| `import-vocabulary --apply` | server client | exit 1 |
| curated placement import/export | service-role client | exit 1 |
| Daily Training | server client; `GAME_RUNTIME` unset | Start fail |
| Free Practice | flags + server client + Auth names | page 404 while flags unset |
| Context Lab | `CONTEXT_LAB_*` + service-role client | page 404 while flag unset |
| Content-release runtime | no Supabase URL/key | deployed writes forbidden |

## 8. Excluded Blaze objects (deny list)

Do not migrate, dump, or recreate on the dedicated target:

- campus tables
- enrollment tables
- newsletter tables
- traffic tables
- `public.users`
- `public.v3_migration_offering_legacy_stage`
- any function or table whose purpose is Blaze campus, not WordRanger
  learning
- Blaze Auth users (count is already 0; still do not treat Blaze Auth
  as the dedicated Auth source)
- platform schema_migrations from `auth` / `realtime` / `storage`

Class: `SHARED_BLAZE_DO_NOT_COPY`.
