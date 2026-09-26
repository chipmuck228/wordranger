# Free Practice Security Migration Deployment Preflight

Candidate / not a Standard. **Read-only.** This document does not apply
the migration, change Vercel env, or enable `/practice`.

- Date: **2026-09-25**
- Branch: `audit/free-practice-security-migration-preflight`
- Base / `origin/main`: `68d113a08c53b8f87281e4cdaddf76fb51047324`
  (PR #13 squash)
- Production identity: Vercel production Supabase hostname **MATCH** to
  the linked project named **blaze** (inventory §14). This pass did not
  re-pull Vercel env values.
- Migration file:
  `supabase/migrations_archive/pre_dedicated_baseline/202609250001_learner_table_server_only_access.sql`
- Migration SHA-256:
  `b6c348f538da8185aac45d06dbf03f1cdbd2e567844bc64e2db2ec5e8c0e7210`
- Pre-apply snapshot (this document's original 2026-09-25 pass):
  **NOT APPLIED**
- Current remote apply status: **APPLIED** through the authorized
  Dashboard SQL Editor. Catalog and runtime verification:
  `docs/FREE_PRACTICE_SECURITY_MIGRATION_APPLY_EVIDENCE.md`.
  Migration history remains absent. `db push` remains forbidden.
  `/practice` remains disabled. Homepage still links to `/train`.
  Candidate / not a Standard.

Do not copy the migration SQL into this file. The authorized apply used
that committed file only.

## 1. Exact six-table scope

Only these relations:

- `public.learning_tasks`
- `public.game_sessions`
- `public.learning_evidence`
- `public.student_lexeme_models`
- `public.student_lexeme_skill_states`
- `public.student_lexeme_weaknesses`

Shared-project campus / enrollment / newsletter / traffic objects and
other WordRanger tables (`lexemes`, `context_lab_runs`, content-release
tables) are out of scope.

## 2. Remote drift vs last inventory

This section is the **pre-apply snapshot**. It is not the current
post-apply catalog.

Read-only Management API catalog (`information_schema` / `pg_catalog` /
`pg_policies`). No learner rows. No `answer_key` data.

| Check | Inventory | This preflight | Drift |
| --- | --- | --- | --- |
| Schema / name | `public.<six>` | same | none |
| Owner | `postgres` | `postgres` | none |
| `learning_tasks` RLS | off | off | none |
| Other five RLS | on | on | none |
| FORCE RLS | off on all six | off on all six | none |
| Policies | none | none | none |
| `PUBLIC` table grants | none listed | none listed | none |
| `anon` / `authenticated` | ALL DML | ALL DML | none |
| `service_role` | ALL DML | ALL DML | none |
| PK | uuid, no sequences | uuid, no sequences | none |
| `learning_tasks.answer_key` | present | `jsonb not null` | none |
| Evidence trigger | `learning_evidence_no_update` BEFORE UPDATE/DELETE | same | none |
| Client views on the six | none found | none | none |
| `supabase_migrations.schema_migrations` | absent | absent | none |
| Management API migration list | `[]` | `[]` | none |

`prevent_learning_evidence_mutation` still exists (SECURITY INVOKER)
with EXECUTE for `PUBLIC` / `anon` / `authenticated` / `postgres` /
`service_role`. It is the append-only trigger body, not a client CRUD
RPC. `cleanup_progress_test_user` remains **absent** remotely.

Migration statements are compatible with this catalog:

- `ALTER … ENABLE ROW LEVEL SECURITY` turns `learning_tasks` on; the
  other five are already on (no-op).
- `REVOKE … FROM PUBLIC` is a no-op given no listed PUBLIC grants.
- `REVOKE … FROM anon/authenticated` removes the current ALL grants.
- `GRANT SELECT, INSERT, UPDATE, DELETE … TO service_role` is already
  satisfied (service_role already has ALL).
- No FORCE, no policies, no sequence GRANT/REVOKE.

## 3. Code access paths

Classification of repository `.from("<learner table>")` call sites:

| Path | Class | Client |
| --- | --- | --- |
| `/train` Daily Training stores + learning + tasks | A server service-role preferred | `createSupabaseServerClient()` (service_role, anon fallback only if service_role unset) |
| Free Practice supabase runtime | A | same server client |
| Context Lab supabase runtime | A | `createSupabaseServiceRoleClient()` only; no anon fallback |
| Free-play game session stores | A | `createSupabaseServerClient()` |
| Scheduler query adapter | A | same server client |
| Free Practice identity `auth.getUser()` | B server anon, **Auth only** | `@supabase/ssr` anon key; no learner-table CRUD |
| `createSupabaseBrowserClient()` | C unused | defined, **zero app imports** |
| `prevent_learning_evidence_mutation` | D trigger | append-only; not a browser API |
| Debug Task / Scheduler labs | E | in-memory repositories |

`getTaskForEvaluation` on `main` still requires
`{ taskId, userId, sessionId }` and the Supabase adapter filters
`id + user_id + session_id` before selecting `answer_key`.

No production browser or anon learner-table CRUD path was found.
Revoking client DML does not break a live `/train` pipeline that has
the production service-role env name present (values were not re-read).

Stop apply if production later lacks the service-role env name: the
server client would fall back to anon and then fail closed on RLS.

## 4. Authorized apply channel

Compared:

1. **CLI `db push` / migration apply** — **unsafe**. Remote CLI history
   is empty. Push would attempt every repo file, including objects that
   already exist and files whose objects are absent
   (`cleanup_progress_test_user`, `vocabulary_placement_reviews`).
   Forbidden.
2. **Direct Postgres / pooler** — inventory recorded TransportError.
   This pass: Management API catalog SELECT works; `supabase db query
   --linked` accepted `SELECT 1` (constant only). That does **not**
   prove a durable pooler identity and is **not** the apply channel.
3. **Management API `database/query`** — can run SQL, but this preflight
   forbids executing the migration through it. Transaction wrapping of
   a multi-statement script is not contractually guaranteed here.
4. **Dashboard SQL editor** — authorized human pastes the **committed
   file** once, including its `begin;` / `commit;`.

**Recommended unique apply channel:** Supabase Dashboard SQL editor,
run by an authorized operator, using the committed file at the SHA-256
above. Do not edit the SQL. Do not add other statements.

Transaction: the file already wraps all ALTER / REVOKE / GRANT in
`begin;` / `commit;`. The Dashboard script runner is the channel that
keeps that file intact as one script.

Authorization: project owner / database admin for the linked production
project. This document does **not** grant that authorization.

History: Dashboard apply **does not** create
`supabase_migrations.schema_migrations` and **must not**. Do not repair
history, do not insert fake versions, do not mark older files applied.

Deployment facts (after a later authorized apply):

- this runbook + a short apply-evidence note (date, operator role,
  file SHA-256, post-check catalog matrix)
- Markdown only; no database object comments

Future `db push` remains **forbidden** until a later contract designs a
baseline/repair strategy. Apply via Dashboard does not make `db push`
safe.

## 5. Pre-apply assertions (stop if any fail)

- `origin/main` still contains the file at the SHA-256 above.
- Production identity still MATCH (do not guess).
- All six `public` tables exist, owner `postgres`.
- `learning_tasks.answer_key` still exists.
- FORCE RLS is off on all six.
- Zero policies on all six.
- `service_role` still has SELECT/INSERT/UPDATE/DELETE on all six.
- SQL file still names only the six tables, still has `begin;`/`commit;`,
  still has no dynamic SQL / catalog scan / other schemas.
- Vercel production still lists a service-role key **name** (do not
  print the value).
- `/practice` flags remain unset.

## 6. Apply (future authorization only)

1. Re-run the pre-apply assertions.
2. Open the committed file; do not copy a second SQL source.
3. Paste into Dashboard SQL editor; execute once.
4. If the script errors, **stop**. Do not revoke/grant by hand. Do not
   restore client ALL grants. Do not run a destructive rollback.
5. Keep `/practice` disabled.

This preflight does **not** perform those steps.

## 7. Post-apply catalog assertions

For each of the six tables:

- RLS enabled
- FORCE RLS off
- zero policies
- `PUBLIC` / `anon` / `authenticated`: no table privileges
- `service_role`: SELECT, INSERT, UPDATE, DELETE

Unchanged: uuid PKs, no sequences, evidence append-only trigger,
`answer_key` column present.

## 8. Zero-data probes

This pass **did not** call PostgREST with the anon key. A metadata
`limit=0` request can still emit headers or fail open if the client is
misbuilt. Catalog grants already prove current anon table privilege.

Post-apply probe (later authorization, still no learner ids):

- anon GET of `learning_tasks` with `select=id` and `limit=0`
- no `Prefer: count=exact`
- no `answer_key` in select
- expect deny (401/403 or equivalent privilege/RLS failure)
- record only status class and empty-body boolean

service_role server pipeline must keep working (see smoke tests).

## 9. Server-side smoke-test plan (after apply, separate auth)

One controlled test identity only. No production student traffic
change. `/practice` stays closed.

1. `/train` start persists a `game_sessions` row and a `learning_tasks`
   row via the server service-role client.
2. Submit through `submitTaskAction` /
   `getTaskForEvaluation({ taskId, userId, sessionId })`.
3. Confirm a foreign `userId` or `sessionId` does not load `answer_key`.
4. Do not enable Homepage or `/practice`.

## 10. Failure handling

- Do not restore client ALL grants.
- Do not auto-run destructive rollback.
- Leave `/practice` closed.
- Record the failed statement class (ALTER / REVOKE / GRANT) and the
  catalog matrix at stop time.
- A later forward migration is the only rollback design.

## 11. Independent authorizations

| Decision | This document |
| --- | --- |
| Write this preflight | done |
| Apply the migration | later authorized; Dashboard apply recorded |
| Enable `/practice` | **not authorized**; separate later decision |
| Change Vercel env | **not authorized** |
| Homepage integration | **not authorized** |
| `db push` / history repair | **forbidden** |

## 12. Local leftovers (not part of this work)

Untracked on the operator machine and **not** committed: Phase zip
dumps, `docs/qa`, `supabase/.temp`, batch-03 `HUMAN_REVIEW` copies,
`tests/training/daily-training-multi-round-diagnosis.test.ts`, and a
local `.gitignore` edit.
