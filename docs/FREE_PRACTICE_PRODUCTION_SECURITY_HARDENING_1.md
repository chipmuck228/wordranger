# Free Practice Production Security Hardening Slice 1

Candidate / not a Standard. This slice is **validated in repo, not deployed**.

- Branch: `security/free-practice-production-hardening-1`
- Base: `origin/main` @ `36d1fa97cfc7ccd0a797bdf46c411d93b59ed121`
- Remote identity: Vercel production Supabase hostname **MATCH** to linked `blaze` (inventory §14)
- Migration file is **committed, not remotely applied**. Not `db push`.
- SQL targets `public.<table>` so a shared `blaze` `search_path` cannot
  resolve a different schema. Deployment status is Markdown-only; it is
  not written into database object comments.

## Why server-only + revoke

WordRanger already loads learner data on the server:

```text
Browser
  → Next.js server action / controller
  → server-verified identity
  → server repository
  → learner tables (service_role data client)
```

There is no approved browser CRUD path for learner tables. Adding
`auth.uid()` policies in this slice would invent a client access model
that the app does not use and that Free Practice cannot mint today
(no login / anonymous account).

This slice therefore:

1. Enables RLS on the six WordRanger learner tables.
2. Revokes `public` / `anon` / `authenticated` DML.
3. Grants `service_role` the DML the existing server pipeline needs.
4. Creates **no** client policies.
5. Tightens `getTaskForEvaluation` so `answer_key` is selected only
   when `taskId + userId + sessionId` match in the same query.

`service_role` bypasses RLS. Application ownership filters are the
mandatory second boundary.

A later contract may add browser-direct access. That requires a new
policy design. Do not treat this revoke as a permanent ban on
`auth.uid()` policies.

## FORCE ROW LEVEL SECURITY

Not used. Reasons:

- Repo convention (`vocabulary_placement_reviews`, `context_lab_runs`)
  is ENABLE without FORCE.
- `service_role` is `BYPASSRLS`; FORCE does not change the app client.
- FORCE with zero policies would lock the table owner and
  `cleanup_progress_test_user` (SECURITY DEFINER) out of cleanup.

## Learner tables (explicit)

From repo migrations + remote inventory. No name patterns.

| Table | Repo RLS before | Remote (`blaze`) | This migration |
| --- | --- | --- | --- |
| `public.learning_tasks` | off | off, client ALL | ENABLE RLS; revoke client; grant service_role |
| `public.game_sessions` | off | on, 0 policies, client ALL | same revoke/grant |
| `public.learning_evidence` | off | on, 0 policies, client ALL | same |
| `public.student_lexeme_models` | off | on, 0 policies, client ALL | same |
| `public.student_lexeme_skill_states` | off | on, 0 policies, client ALL | same |
| `public.student_lexeme_weaknesses` | off | on, 0 policies, client ALL | same |

No sequences exist for these uuid PK tables.

Not touched: campus, enrollment, newsletter, traffic, `lexemes`,
`learning_sessions`, Context Lab / content-release tables.

## answer_key lookup

Old path:

```text
getTaskForEvaluation(taskId)
  → SELECT answer_key WHERE id = taskId
  → in-process user/session check
```

New path:

```text
getTaskForEvaluation({ taskId, userId, sessionId })
  → SELECT answer_key WHERE id AND user_id AND session_id
  → missing / foreign / mismatch all return null
```

`submitTaskAction` maps all of those to `TASK_NOT_FOUND`. It no longer
emits `TASK_USER_MISMATCH` / `TASK_SESSION_MISMATCH`.

`userId` still comes from the server controller, never the browser.

## Rollback analysis

Do not ship a down migration that restores client ALL grants. If this
file must be reverted before apply, delete or repair the migration
history only on an unused project. After apply, rollback is a new
forward migration designed under a later contract.

## Out of scope

- Applying the migration
- Vercel env / `/practice` / Homepage
- Frozen Scheduler, LearningNeed, Evaluator, Evidence, `processEvidence`
- Shared blaze non-WordRanger objects
