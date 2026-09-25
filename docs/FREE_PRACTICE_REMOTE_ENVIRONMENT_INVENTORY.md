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

Vercel env metadata is now verified for the linked `wordranger` project:
Free Practice flags are **absent** in development, preview, and
production. Production has Supabase URL / anon / service-role names
present (values encrypted, unread). Preview and development have
**no** listed env names.

Supabase catalog, migration history, RLS, and grants remain
**NOT VERIFIED**. The workspace still has no Supabase CLI link.

The public production origin used for HTTP checks is
`https://engsme.cn` → `https://www.engsme.cn`.
GitHub repository `homepage` (`https://wordranger.vercel.app`) and the
Vercel git-main alias are **not** treated as that public origin.
The git-main alias is behind Vercel Deployment Protection (login / 403)
and is not application status.

## 2. Authorization availability

| Channel | Status | Correct project identity |
| --- | --- | --- |
| Supabase CLI | **not installed** | **not linked** |
| `supabase/config.toml` | **absent** | n/a |
| `supabase/.temp` | **absent** | n/a |
| Vercel CLI | installed (`54.14.0`) | **linked** to existing `wordranger` project |
| `.vercel/` | **present** (`repo.json`; no `project.json`) | matches CLI project name `wordranger` |
| `vercel env ls` | **ran** (names + target only) | see §8 |
| Process env Free Practice / Supabase keys | **absent** in the audit shell | n/a |
| Local `.env.local` file | **present** on disk | **not read** |
| `vercel env pull` | **not run** | would write secrets into the workspace |
| `supabase link` | **not run** | still blocked |

No project ref, token, connection string, or key is recorded here.

Non-secret recovery steps for a later authorized pass:

1. Vercel link is done. Do not `vercel env pull`, `env add`, or redeploy.
2. Install Supabase CLI and link the existing WordRanger project. Do not paste keys into chat.
3. Query `information_schema` / `pg_catalog` only. Do not `db push`, migrate, or read learner rows.

## 3. Migration comparison

Repo migrations under `supabase/migrations/` (local source of truth for **expected** SQL):

| File | Remote applied |
| --- | --- |
| `202609160001_vocabulary_domain.sql` | **NOT VERIFIED** |
| `202609160002_learning_tasks.sql` | **NOT VERIFIED** |
| `202609170001_game_sessions.sql` | **NOT VERIFIED** |
| `202609170002_game_sessions_revision.sql` | **NOT VERIFIED** |
| `202609170003_learning_evidence_session_correlation.sql` | **NOT VERIFIED** |
| `202609170004_cleanup_progress_test_user.sql` | **NOT VERIFIED** |
| `202609170005_vocabulary_placement_reviews.sql` | **NOT VERIFIED** |
| `202609200001_context_lab_runs.sql` | **NOT VERIFIED** |
| `202609220001_contextual_content_releases.sql` | **NOT VERIFIED** |
| `202609220002_contextual_content_active_releases.sql` | **NOT VERIFIED** |
| `202609220003_contextual_content_batch_promotions.sql` | **NOT VERIFIED** |

Missing / extra / divergent remote migrations: **NOT VERIFIED**. There is no Free Practice-specific migration in the repo. “Files exist” is not “applied on the target project.”

No `db push`, migration up/down/repair, or history edit was run.

## 4. Remote schema matrix

| Object | Repo expectation | Remote |
| --- | --- | --- |
| `game_sessions` | `user_id`, `game_type`, `state jsonb`, `revision`, indexes | **NOT VERIFIED** |
| `learning_tasks` | `user_id`, `session_id`, `public_payload`, `answer_key` | **NOT VERIFIED** |
| `learning_evidence` | `user_id`, `task_id` unique, append-only trigger, `session_id` correlation | **NOT VERIFIED** |
| `student_lexeme_models` | unique `(user_id, lexeme_id)` | **NOT VERIFIED** |
| `student_lexeme_skill_states` | unique `(model_id, skill)` | **NOT VERIFIED** |
| `student_lexeme_weaknesses` | model-scoped | **NOT VERIFIED** |

Remote columns, constraints, and indexes were not queried. No learner rows were read.

## 5. Remote RLS matrix

| Table | RLS enabled | Force RLS | Policies | `auth.uid()` bind |
| --- | --- | --- | --- | --- |
| `game_sessions` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `learning_tasks` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `learning_evidence` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `student_lexeme_models` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `student_lexeme_skill_states` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `student_lexeme_weaknesses` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |

Repo SQL for these learner tables does **not** enable RLS. That is a local-source finding from the previous audit, not a remote fact.

## 6. Remote grants matrix

| Role | Table privileges on learner tables |
| --- | --- |
| `public` | **NOT VERIFIED** |
| `anon` | **NOT VERIFIED** |
| `authenticated` | **NOT VERIFIED** |
| `service_role` | **NOT VERIFIED** |

Repo SQL does not revoke client roles on learner tables. Remote defaults remain unknown.

## 7. RPC / function matrix

| Function | Path | Remote security | Execute grants | Accepts userId | On `/practice` path |
| --- | --- | --- | --- | --- | --- |
| `prevent_learning_evidence_mutation` | repo trigger | **NOT VERIFIED** | **NOT VERIFIED** | no | indirect (append-only) |
| `cleanup_progress_test_user` | repo test RPC | **NOT VERIFIED** | repo: `service_role` only | yes (target uuid) | **no** |

No remote function catalog was read. Search path and SECURITY DEFINER/INVOKER on the live project are **NOT VERIFIED**.

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

This matches `www.engsme.cn/practice` **404**. It does not prove remote
schema or RLS.

## 9. HTTP route findings

Public production origin (this pass): `https://engsme.cn`
canonical: `https://www.engsme.cn` (`308` from apex).

Unauthenticated GET via proxy `127.0.0.1:7897`, no login, no POST:

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

No remote schema drift can be confirmed, because remote schema was not read.

Confirmed **authorization blockers** remaining:

1. Supabase CLI missing and project not linked (schema / RLS / grants).
2. Direct GET without proxy often times out from this workspace.
3. The Vercel git-main alias is behind Deployment Protection.

Confirmed **Vercel / HTTP facts**:

- Free Practice flag names absent in development, preview, production.
- Production has Supabase key **names** only.
- `www.engsme.cn/practice` is **404**.

Prior production-readiness audit blockers (identity mint, repo RLS absence, service-role data client, unscoped task get) remain **design findings**, not newly verified remote facts.

## 11. NOT VERIFIED

- Remote migration history vs repo
- Remote table/column/constraint/index existence
- Remote RLS, force RLS, policies
- Remote grants for `public` / `anon` / `authenticated` / `service_role`
- Remote RPC security attributes
- Preview `/practice` HTTP (no preview hostname probed; preview env has no FP flags)
- Live A/B isolation
- Any finding previously taken from `wordranger.vercel.app`

## 12. Minimum corrective slices

Not implemented:

1. Install Supabase CLI and link the existing WordRanger project.
2. Repeat catalog / migration-history / RLS / grant queries only.
3. Do not enable `/practice` or start a fix slice from this document.

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
