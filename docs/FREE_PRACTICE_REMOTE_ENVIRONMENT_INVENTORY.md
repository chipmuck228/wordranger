# Free Practice Remote Environment Inventory

## 1. Status

- Audit date: **2026-09-25**
- Branch: `audit/free-practice-remote-inventory`
- Base / start SHA: `origin/main` @ `8c50bbe8e0da721793366f86c7f66b8573ac1d8f`
- Mode: **read-only**
- Candidate / Not a Standard
- Production activation: **unchanged**

This inventory does not approve preview or production enablement. It records what this workspace could and could not verify.

**Conclusion: `BLOCKED_NOT_VERIFIED`**

The workspace does not have a linked Supabase project or a linked Vercel project. No remote catalog, migration history, RLS, grant, or Vercel env metadata was read. One official public hostname from GitHub repo `homepage` was probed without credentials; that is not a substitute for schema or env inventory.

## 2. Authorization availability

| Channel | Status | Correct project identity |
| --- | --- | --- |
| Supabase CLI | **not installed** | **not linked** |
| `supabase/config.toml` | **absent** | n/a |
| `supabase/.temp` | **absent** | n/a |
| Vercel CLI | installed (`54.14.0`) | **not linked** |
| `.vercel/project.json` | **absent** | n/a |
| `vercel env ls` | refused: codebase is not linked | n/a |
| Process env Free Practice / Supabase keys | **absent** in the audit shell | n/a |
| Local `.env.local` file | **present** on disk | **not read** (would expose secrets) |
| `vercel env pull` | **not run** | would write secrets into the workspace |
| `vercel link` / `supabase link` | **not run** | not authorized by this task |

No project ref, token, connection string, or key is recorded here.

Non-secret recovery steps for a later authorized pass:

1. On a machine that already owns this project, install Supabase CLI and link the existing WordRanger project. Do not paste keys into chat.
2. Run `vercel link` against the Vercel project already used by this repo’s GitHub deployment checks. Do not create a new project.
3. Re-run this inventory. Use `vercel env ls` (names only). Do not `vercel env pull`, `env add`, or redeploy.
4. Query `information_schema` / `pg_catalog` only. Do not `db push`, migrate, or read learner rows.

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

`vercel env ls` was not available (project not linked). Values were not printed. `vercel env pull` was not run.

| Variable | development | preview | production |
| --- | --- | --- | --- |
| `FREE_PRACTICE_ENABLED` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `FREE_PRACTICE_RUNTIME` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `WORD_RANGER_FREE_PRACTICE_E2E` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `WORD_RANGER_FREE_PRACTICE_E2E_PROBE` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `NEXT_PUBLIC_SUPABASE_URL` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |
| `SUPABASE_SERVICE_ROLE_KEY` | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |

Cannot confirm from Vercel metadata whether production/preview accidentally enable Free Practice, memory, test identity, or the E2E probe.

Process env in this audit shell: all of the above names **absent**.

## 9. HTTP route findings

GitHub repository `homepage` is `https://wordranger.vercel.app`. That is the only official public origin used. Preview hostnames were **not guessed**.

Local `curl` / `fetch` from this workspace **timed out**. A separate unauthenticated GET (WebFetch) reached that origin:

| Route | Result | Notes |
| --- | --- | --- |
| `GET /practice` | **404** | Matches a closed Candidate route. No POST. |
| `GET /practice/e2e-probe` | **404** | Probe should be closed on deployed hosts. |
| `GET /` | **200** | Homepage Daily Training copy. Converted page text has no `/practice` path. Raw `href` scan from this host **NOT VERIFIED**. |
| `GET /train` | **200** | Existing Daily Training surface (product label still 自由练习). |
| `GET /play/context-lab` | **404** | Observed closed/gated response. Not treated as a Free Practice change. |

No login, no server action, no session/task/Evidence create. Preview HTTP: **NOT VERIFIED**.

## 10. Confirmed drift / blockers

No remote schema drift can be confirmed, because remote schema was not read.

Confirmed **authorization blockers** for this inventory:

1. Supabase CLI missing and project not linked.
2. Vercel project not linked; env metadata unread.
3. This host cannot complete direct TCP GET to the official hostname (timeout). WebFetch 404s are the only live HTTP evidence.

Prior production-readiness audit blockers (identity mint, repo RLS absence, service-role data client, unscoped task get) remain **design findings**, not newly verified remote facts.

## 11. NOT VERIFIED

- Remote migration history vs repo
- Remote table/column/constraint/index existence
- Remote RLS, force RLS, policies
- Remote grants for `public` / `anon` / `authenticated` / `service_role`
- Remote RPC security attributes
- All Vercel env names in development / preview / production
- Whether preview accidentally enables Free Practice
- Whether production env still has flags unset (HTTP 404 is consistent with unset **or** with other fail-closed paths)
- Preview `/practice` HTTP
- Raw Homepage `href="/practice"` absence
- Live A/B isolation

## 12. Minimum corrective slices

Not implemented:

1. Link this repo to the existing Supabase and Vercel projects on an authorized machine.
2. Repeat this inventory with catalog queries and `vercel env ls`.
3. Only after that, decide whether a persistence / identity slice is next. Do not enable `/practice` from this document.

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
