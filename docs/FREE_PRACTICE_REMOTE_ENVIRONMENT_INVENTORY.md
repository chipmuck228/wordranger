# Free Practice Remote Environment Inventory

## 1. Status

- Audit date: **2026-09-25**
- Branch: `audit/free-practice-remote-inventory`
- Base / start SHA: `origin/main` @ `8c50bbe8e0da721793366f86c7f66b8573ac1d8f`
- Mode: **read-only**
- Candidate / Not a Standard
- Production activation: **unchanged**

This inventory does not approve preview or production enablement. It records what this workspace could and could not verify.

**Conclusion: `PARTIALLY_VERIFIED`**

Public HTTP on `www.engsme.cn` is verified: `/practice` and the E2E
probe are **404**; Homepage links `/train` only; `/train` is up.

Vercel env metadata is verified for the linked `wordranger` project:
Free Practice flags are **absent** in development, preview, and
production. Production has Supabase URL / anon / service-role names
present (values encrypted, unread). Preview and development have
**no** listed env names.

The user-linked Supabase project (CLI name **`blaze`**) was catalogued
read-only through the Management API. Learner tables, RLS, policies,
and grants below are facts about **that linked project**. They are
**not** a proven `NEXT_PUBLIC_SUPABASE_URL` match to `www.engsme.cn`.

The public production origin used for HTTP checks is
`https://engsme.cn` → `https://www.engsme.cn`.
GitHub repository `homepage` (`https://wordranger.vercel.app`) and the
Vercel git-main alias are **not** treated as that public origin.
The git-main alias is behind Vercel Deployment Protection (login / 403)
and is not application status.

## 2. Authorization availability

| Channel | Status | Correct project identity |
| --- | --- | --- |
| Supabase CLI | **npx `supabase@latest` / `@2.117.0`** (not on PATH) | **linked**; project **name** `blaze` |
| `supabase/config.toml` | **absent** | n/a |
| `supabase/.temp` | **present locally** (not committed) | link files only; contents not recorded |
| Account project names | `blaze`, `meridianspark`, `meridianspark-mvp`, `summer-track` | **no** project named `wordranger` |
| Public bundle ↔ linked ref | **NOT VERIFIED** | homepage / `/train` JS crawl found no `*.supabase.co` host |
| Vercel CLI | installed (`54.14.0`) | **linked** to existing `wordranger` project |
| `.vercel/` | **present** (`repo.json`; no `project.json`) | matches CLI project name `wordranger` |
| `vercel env ls` | **ran** (names + target only) | see §8 |
| Process env Free Practice / Supabase keys | **absent** in the audit shell | n/a |
| Local `.env.local` file | **present** on disk | **not read** |
| `vercel env pull` | **not run** | would write secrets into the workspace |
| `supabase link` | **already done by the operator** | this pass did not re-link |
| Direct Postgres / pooler | **blocked** (`LegacyDbConfigLoginRoleNetworkError` / `TransportError`) | catalog used Management API instead |
| `supabase db query --linked` | **same TransportError** (login-role init) | bypassed via `POST /v1/projects/{ref}/database/query` |

No project ref, token, connection string, or key is recorded here.
`supabase/.temp` was not staged.

Catalog method: Management API `SELECT` on `information_schema` /
`pg_catalog` / `pg_policies` only. No `--db-url`. No learner-row
`SELECT`. No `db push`, migrate, or history repair.

## 3. Migration comparison

Repo migrations under `supabase/migrations/` (local source of truth for **expected** SQL):

Remote CLI history is **empty**: Management API `GET /database/migrations`
returned `[]`, and `supabase_migrations.schema_migrations` **does not
exist**. File-by-file “applied” below is **object-presence inference**,
not migration-history proof.

| File | Remote applied |
| --- | --- |
| `202609160001_vocabulary_domain.sql` | **objects present** (tables + append-only trigger) |
| `202609160002_learning_tasks.sql` | **objects present** (`learning_tasks` + partial unique `learning_evidence.task_id`) |
| `202609170001_game_sessions.sql` | **objects present** |
| `202609170002_game_sessions_revision.sql` | **objects present** (`revision` + `game_sessions_revision_nonnegative`) |
| `202609170003_learning_evidence_session_correlation.sql` | **objects consistent** (no `learning_evidence.session_id` FK) |
| `202609170004_cleanup_progress_test_user.sql` | **ABSENT** (`cleanup_progress_test_user` not in `public`) |
| `202609170005_vocabulary_placement_reviews.sql` | **ABSENT** (table missing) |
| `202609200001_context_lab_runs.sql` | **objects present** |
| `202609220001_contextual_content_releases.sql` | **objects present** |
| `202609220002_contextual_content_active_releases.sql` | **objects present** |
| `202609220003_contextual_content_batch_promotions.sql` | **objects present** |

Other migration-named relations on the linked project:
`auth.schema_migrations`, `realtime.schema_migrations`,
`storage.migrations` (platform), and
`public.v3_migration_offering_legacy_stage` (unrelated campus table).

The linked project also has an older Blaze campus / enrollment /
newsletter / traffic surface (dozens of extra `public` tables and
functions named `*blaze*`). That is shared-project context, not a Free
Practice object.

No `db push`, migration up/down/repair, or history edit was run.

## 4. Remote schema matrix

Linked project catalog. No learner rows were read.

| Object | Repo expectation | Remote (linked `blaze`) |
| --- | --- | --- |
| `game_sessions` | `user_id`, `game_type`, `state jsonb`, `revision`, indexes | **present**: columns match, including `revision bigint not null`; indexes `user_id`, `game_type`, `updated_at` |
| `learning_tasks` | `user_id` nullable, `session_id`, `public_payload`, `answer_key` | **present**: columns match; `user_id` nullable |
| `learning_evidence` | `user_id`, `task_id` unique partial, append-only trigger, `session_id` correlation (no FK) | **present**: `task_id` nullable + unique index `WHERE task_id IS NOT NULL`; no `session_id` FK; trigger `learning_evidence_no_update` BEFORE UPDATE/DELETE |
| `student_lexeme_models` | unique `(user_id, lexeme_id)` | **present** |
| `student_lexeme_skill_states` | unique `(model_id, skill)` | **present** (`student_lexeme_model_id`, `skill`) |
| `student_lexeme_weaknesses` | model-scoped | **present** |
| `vocabulary_placement_reviews` | repo table + RLS + revoke client roles | **missing** |

Confirmed uniques / indexes (definitions, not row counts):

- `learning_evidence_task_id_uidx` — `UNIQUE (task_id) WHERE task_id IS NOT NULL`
- `student_lexeme_models_user_id_lexeme_id_key` — `UNIQUE (user_id, lexeme_id)`
- `student_lexeme_skill_states_student_lexeme_model_id_skill_key` — `UNIQUE (student_lexeme_model_id, skill)`

## 5. Remote RLS matrix

| Table | RLS enabled | Force RLS | Policies | `auth.uid()` bind |
| --- | --- | --- | --- | --- |
| `game_sessions` | **on** | **off** | **none** | **none** |
| `learning_tasks` | **off** | **off** | **none** | **none** |
| `learning_evidence` | **on** | **off** | **none** | **none** |
| `student_lexeme_models` | **on** | **off** | **none** | **none** |
| `student_lexeme_skill_states` | **on** | **off** | **none** | **none** |
| `student_lexeme_weaknesses` | **on** | **off** | **none** | **none** |

Repo SQL for these learner tables does **not** enable RLS. Remote drift:
five of six have RLS on, still with **zero** policies. `learning_tasks`
is the table that remains RLS-off.

RLS on + no policies denies `anon` / `authenticated` row access
(owner / `service_role` still bypass unless FORCE RLS). That is not an
`auth.uid()` student policy.

## 6. Remote grants matrix

| Role | Table privileges on the six learner tables |
| --- | --- |
| `public` / `PUBLIC` | **none listed** |
| `anon` | **ALL** (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) |
| `authenticated` | **ALL** (same set) |
| `service_role` | **ALL** (same set) |

Combined with §5: `learning_tasks` is RLS-off and `anon` has full DML,
including `answer_key`. The other five learner tables are RLS-on with
no policies, so client roles are blocked at RLS while grants remain
wide. `service_role` bypasses RLS.

Repo SQL does not revoke client roles on these learner tables. The
remote defaults match that omission.

## 7. RPC / function matrix

| Function | Path | Remote security | Execute grants | Accepts userId | On `/practice` path |
| --- | --- | --- | --- | --- | --- |
| `prevent_learning_evidence_mutation` | trigger on `learning_evidence` | **SECURITY INVOKER** (`prosecdef` false) | `PUBLIC`, `anon`, `authenticated`, `postgres`, `service_role` | no | indirect (append-only) |
| `cleanup_progress_test_user` | repo test RPC | **ABSENT** | n/a | yes (target uuid) | **no** |

Related contextual-content RPCs exist on the same project
(`promote_contextual_content_batch`,
`publish_contextual_content_release`,
`rollback_contextual_content_active_release`) as **SECURITY DEFINER**.
They are not Free Practice `/practice` path objects; execute grants
were not expanded in this pass.

## 8. Vercel environment matrix

Source: `vercel env ls`, `vercel env ls development|preview|production`.
Values were not printed (`Encrypted` only). `vercel env pull` / add / rm
and redeploy were not run.

| Variable | development | preview | production |
| --- | --- | --- | --- |
| `FREE_PRACTICE_ENABLED` | **absent** | **absent** | **absent** |
| `FREE_PRACTICE_RUNTIME` | **absent** | **absent** | **absent** |
| `WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY` | **absent** | **absent** | **absent** |
| `WORD_RANGER_FREE_PRACTICE_E2E` | **absent** | **absent** | **absent** |
| `WORD_RANGER_FREE_PRACTICE_E2E_PROBE` | **absent** | **absent** | **absent** |
| `NEXT_PUBLIC_SUPABASE_URL` | **absent** | **absent** | **present** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **absent** | **absent** | **present** |
| `SUPABASE_SERVICE_ROLE_KEY` | **absent** | **absent** | **present** |

Confirmed from names only:

1. Production does **not** list `FREE_PRACTICE_ENABLED`.
2. Preview lists **no** env names, so Free Practice is not accidentally on.
3. `FREE_PRACTICE_RUNTIME=memory` is not configured on preview/production.
4. Test identity and E2E probe names are absent on preview/production.
5. Supabase URL / anon / service-role names exist on **production only**.

This matches `www.engsme.cn/practice` **404**. It does not prove the
Vercel production URL points at linked project `blaze`.

## 9. HTTP route findings

Public production origin (this pass): `https://engsme.cn`
canonical: `https://www.engsme.cn` (`308` from apex).

Unauthenticated GET via proxy `127.0.0.1:7897` (earlier pass) and
direct GET (this pass), no login, no POST:

| Route | Result | Notes |
| --- | --- | --- |
| `GET https://engsme.cn/practice` | **308** → `https://www.engsme.cn/practice` | |
| `GET https://www.engsme.cn/practice` | **404** | Candidate route closed on this host. |
| `GET /practice/e2e-probe` | **404** | Probe closed. |
| `GET /` | **200** | Homepage. `href="/train"` present. No `href` containing `practice`. |
| `GET /train` | **200** | Daily Training (product label still 自由练习). |
| `GET /play/context-lab` | **404** | Observed closed/gated. Not treated as an FP change. |

`wordranger.vercel.app` first-pass 404s remain **withdrawn**.
`wordranger-git-main-zhen-lius-projects.vercel.app` remains
Deployment Protection (login/403), not app status.
Preview HTTP: **NOT VERIFIED**.

## 10. Confirmed drift / blockers

Confirmed on the **linked** project (name `blaze`):

1. No `supabase_migrations` history table; Management API migration list is empty.
2. `vocabulary_placement_reviews` missing (repo file not reflected).
3. `cleanup_progress_test_user` missing (repo file not reflected).
4. Learner-table RLS does not match repo SQL: five tables RLS-on / zero policies; `learning_tasks` RLS-off.
5. `anon` / `authenticated` retain full DML grants on all six learner tables.
6. Direct pooler / `db query --linked` still cannot initialise a login role from this workspace (`TransportError`). Catalog required the Management API.
7. Public production URL ↔ linked project ref remains **NOT VERIFIED**.

Confirmed **Vercel / HTTP facts** (unchanged):

- Free Practice flag names absent in development, preview, production.
- Production has Supabase key **names** only.
- `www.engsme.cn/practice` is **404**.

Prior production-readiness audit blockers (identity mint, repo RLS
absence, service-role data client, unscoped task get) are now
**partially grounded** in this linked catalog: remote `learning_tasks`
is RLS-off with client ALL grants; other learner tables are RLS-on
without student policies.

## 11. NOT VERIFIED

- Linked project `blaze` === Vercel production `NEXT_PUBLIC_SUPABASE_URL`
- Migration history vs repo (history table absent; only object inference)
- Preview `/practice` HTTP (no preview hostname probed; preview env has no FP flags)
- Live A/B isolation
- Execute-grant details for contextual-content SECURITY DEFINER RPCs
- Any finding previously taken from `wordranger.vercel.app`

## 12. Minimum corrective slices

Not implemented:

1. Confirm the Vercel production Supabase URL host equals the linked project (names only; do not paste refs or keys).
2. Do not enable `/practice` or start a fix slice from this document.
3. Do not apply the missing placement-review / cleanup migrations from this inventory.

## 13. Explicit confirmation

- No migration applied
- No DDL / DML
- No learner rows read
- No remote data written
- No Vercel env add / rm / pull
- No redeploy
- No production activation
- No Homepage integration
- No frozen learning-semantics change
- No secret printed or committed

`.env.local` exists locally and was not opened.
`supabase/.temp` exists locally and was not opened in the inventory
text or committed.
