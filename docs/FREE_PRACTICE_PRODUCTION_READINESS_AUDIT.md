# Free Practice Production-Readiness Audit

## 1. Status

- Status: **Candidate / Not a Standard**
- Audit date: **2026-09-25**
- Audited branch: `audit/free-practice-production-readiness`
- Audited base / head: `origin/main` @ `3f22005c20ca53ce39c46c86f0f375b6e657f6bc`
- PR #10 squash is on `main` (`Add gated Free Practice Candidate Direct UI (#10)`). Tree matches former head `2ca7bad58a9911e217c4cfae45ae2ef0abe96b23`.
- Production activation: **unchanged**. This audit did not set Vercel env vars, apply migrations, enable `/practice`, wire Homepage, or write remote data.

## 2. Executive conclusion

**NOT_READY**

Confirmed blockers exist even before remote verification:

1. This app has **no login UI and no approved anonymous-account mint**. Cookie `auth.getUser()` is implemented, but a visitor cannot obtain a Supabase Auth session here. Placeholder identity is forbidden. Shared-browser identity is forbidden.
2. Learner tables used by Free Practice have **no RLS and no client-role revokes** in committed migrations. The data client **prefers the service-role key**, which bypasses RLS even if policies were added later.
3. `getTaskForEvaluation(taskId)` loads **any** `learning_tasks` row by id, including `answer_key`, then checks ownership in process.

Remote schema, live multi-user isolation, and actual Vercel env values are **NOT VERIFIED**. Those gaps would independently block `READY_FOR_ISOLATED_PREVIEW`.

Do **not** enable `FREE_PRACTICE_ENABLED` on Vercel preview or production.

## 3. Identity findings

### Call chain

```text
Browser
  → GET /practice  (flag only; no user lookup)
  → Server Action  (start / load / submit / continue)
      → getFreePracticeController()
          → createIdentityReader()
              public host: readFreePracticeSupabaseSession()
                  @supabase/ssr createServerClient(anon key)
                  cookies()
                  auth.getUser()
              local test gates: createTestFreePracticeSessionReader()
          → resolveFreePracticeIdentity()
              ignoreUntrustedClientUserId()
              reject V1_PLACEHOLDER_USER_ID
          → FreePracticeSessionController
          → plan / session store / task repo / submitTaskAction
```

`/practice` page (`src/app/practice/page.tsx`) only calls `isFreePracticePageAvailable()`. It does **not** call `requireFreePracticeIdentity`. Identity runs on each server action.

### Answers

| Question | Finding |
| --- | --- |
| How does supabase `/practice` get the user? | Cookie `auth.getUser()` via anon SSR client, then `resolveFreePracticeIdentity`. Not on first GET. |
| `auth.getUser()` vs cookie payload? | Uses `getUser()`. No `getSession()` under `src/`. |
| Anon vs session vs service-role | Identity: anon key + user cookies. Data: `createSupabaseServerClient()` = service-role if set, else anon. Browser helper `createSupabaseBrowserClient` is unused. |
| Can the browser set userId / ownership / Evidence owner? | No. Actions whitelist-copy only. Controller ignores or rejects injected `userId`. Public DTO forbids `userId`. `releaseId` / `ownerId` are not Free Practice fields. |
| Can `V1_PLACEHOLDER_USER_ID` enter Free Practice? | No. Resolver returns `PLACEHOLDER_FORBIDDEN`. `/train` and Context Lab still use the placeholder. |
| Test identity fail-closed? | Yes on Vercel production/preview and other public-host markers. Local `NODE_ENV=production` still allows it if `WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY=1` **and** `WORD_RANGER_FREE_PRACTICE_E2E=1`. |
| No valid session | Flag off → 404. Flag on → page is enterable; all four actions return `UNAVAILABLE`; no session / task / Evidence created. |
| Login UI or anonymous mint? | **Neither exists.** No `middleware.ts`, no `signInAnonymously`, no auth route. |

### Identity implication

Free Practice **cannot be enabled for the public**. It cannot use the placeholder. It cannot let all browsers share one user. An isolated preview would still need an **out-of-band** approved Auth session that this app does not create.

## 4. Supabase runtime data flow

Factory (`src/server/free-practice/create-free-practice-runtime.ts` + `runtime-policy.ts`):

- Independent of `GAME_RUNTIME` / `RANGER_TRIAL_RUNTIME`.
- Missing / illegal flag or runtime → fail closed.
- `memory` on a public host → `FORBIDDEN`.
- `supabase` does **not** silently fall back to memory. Missing server client throws; actions collapse that to `UNAVAILABLE` / `AUTH_NOT_CONFIGURED`.

| Step | Source | Client | userId bind |
| --- | --- | --- | --- |
| Vocabulary | Bundled JSON, not live `lexemes` | n/a | n/a |
| UNSEEN | `student_lexeme_models` (`lexeme_id`, `mastery_stage`) `.eq("user_id")` + bundled lexemes | data client | server identity |
| RECENTLY_INCORRECT | `learning_evidence` (`id`, `lexeme_id`, `skill`, `outcome`, `occurred_at`) `.eq("user_id")`, latest-terminal-per-skill | data client | server identity |
| Session | `game_sessions` (`game_type = FREE_PRACTICE`) | data client | insert/get/CAS bind `user_id` |
| Task | `learning_tasks` (`public_payload` + `answer_key`) | data client | insert binds `user_id`; **get is id-only** |
| Evidence | `learning_evidence` via frozen `submitTaskAction` | data client | server `userId`; unique `task_id` |
| Learner snapshot | `student_lexeme_models` + skill/weakness children | data client | from evidence `userId` |

`Evidence.gameId` remains the renderer `RANGER_TRIAL`. Orchestration identity is `game_sessions.game_type = FREE_PRACTICE`.

## 5. Schema / migration inventory

Code expects existing V1 tables. **No Free Practice-specific migration.** Docs say “No migration” for Slices 2–4.

| Object | Required by | Migration file | Local source status | Remote applied status | RLS | Grants in repo | Ownership key | Index / constraint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `game_sessions` | session store | `202609170001_game_sessions.sql` | present | **NOT VERIFIED** | off | none | app: `id + user_id + game_type` | PK `id`; user/game/updated indexes |
| `game_sessions.revision` | CAS | `202609170002_game_sessions_revision.sql` | present | **NOT VERIFIED** | n/a | n/a | CAS token | `revision >= 0`; no composite unique |
| `learning_tasks` | assign + evaluate | `202609160002_learning_tasks.sql` | present | **NOT VERIFIED** | off | none | app: `user_id` + `session_id` on insert | PK `id`; user/lexeme indexes; **no session_id index**; stores `answer_key` |
| `learning_evidence` | plan + submit | `202609160001_vocabulary_domain.sql` | present | **NOT VERIFIED** | off | none | `user_id`; `session_id` is correlation only | unique `task_id` where not null; append-only trigger |
| `learning_evidence.session_id` FK drop | correlation | `202609170003_learning_evidence_session_correlation.sql` | present | **NOT VERIFIED** | n/a | n/a | not an FK | leftover `learning_sessions` not required |
| `student_lexeme_models` | UNSEEN + snapshot | `202609160001_vocabulary_domain.sql` | present | **NOT VERIFIED** | off | none | unique `(user_id, lexeme_id)` | user/lexeme/review/stage indexes |
| `student_lexeme_skill_states` | snapshot write only | `202609160001` | present | **NOT VERIFIED** | off | none | model id | unique `(model_id, skill)` |
| `student_lexeme_weaknesses` | snapshot write only | `202609160001` | present | **NOT VERIFIED** | off | none | model id | model index |
| `lexemes` | FK target | `202609160001` | present | **NOT VERIFIED** | off | none | n/a for FP identity | unique `canonical_key`. FP generation uses bundled vocab |
| `prevent_learning_evidence_mutation()` | append-only | `202609160001` | present | **NOT VERIFIED** | n/a | none | n/a | BEFORE UPDATE OR DELETE |
| `cleanup_progress_test_user(uuid)` | test cleanup, not product | `202609170004` | present | **NOT VERIFIED** | n/a | EXECUTE `service_role` only | refuses placeholder | not an FP API |

Session JSON: `fp-session-v2` only. `fp-session-v1` and corrupt JSON fail closed (`INVALID_STATE`). No row migration. Ownership mismatch in the parser maps to `NOT_FOUND`.

Remote checks: **not performed**. There is no `supabase/config.toml`, no Supabase CLI in this environment, and no migration-history script. “Migration files exist” is **not** “migrations are deployed.”

## 6. RLS / grants / service-role matrix

Learner tables used by Free Practice: **RLS not enabled, no policies, no GRANT/REVOKE** in repo migrations. Later admin tables (placement reviews, Context Lab, content releases) enable RLS and revoke client roles. That pattern was **not** applied to learner tables.

| Role | Learner tables in repo SQL | Practical meaning |
| --- | --- | --- |
| `anon` | no revoke | Hosted Supabase defaults typically allow access if grants exist. **Remote grants NOT VERIFIED.** |
| `authenticated` | no revoke | Same. Policies would use `auth.uid()` if they existed. They do not. |
| `service_role` | implicit | Data client prefers this key. **Bypasses RLS.** |

| Question | Finding |
| --- | --- |
| Does service-role bypass RLS? | Yes. |
| Are SECURITY DEFINER RPCs used on the FP path? | No product RPC. Cleanup RPC is service-role only and not called by `/practice`. |
| Can anon/authenticated create another user’s session/task/Evidence if they have a PostgREST client? | Repo schema does not prevent it. Remote grants **NOT VERIFIED**. |
| Does the browser hold the service-role key? | No. Identity and public DTO forbid it. `.env.example` documents names only. |
| Application-layer ownership | Session get/CAS and plan reads always `.eq("user_id")`. `submitTaskAction` rejects task/user/session mismatch. **Single-layer** for task load (id-only + in-process check). |

This is **not** enough for isolated preview: database second layer is missing, and the first layer loads foreign `answer_key` before rejecting.

## 7. Multi-user isolation matrix

Two independent users (`USER_A`, `USER_B`) are proven in **fake-client / in-memory** tests. **Remote Supabase isolation = NOT VERIFIED.** Do not treat the two as the same.

| Operation | A own resource | B attempts A resource | Expected | Local / fake | Remote |
| --- | --- | --- | --- | --- | --- |
| Start session | allowed | cannot choose A identity | isolated | PASS | NOT VERIFIED |
| Load session | allowed | B loads A `sessionId` | `NOT_FOUND` | PASS (`session-foundation` F, evidence I) | NOT VERIFIED |
| Submit | allowed | B submits A session/task | rejected | PASS (evidence I) | NOT VERIFIED |
| Continue | allowed | B advances A session | `NOT_FOUND` | PASS (evidence I) | NOT VERIFIED |
| UNSEEN planning | A snapshots only | B snapshot must not affect A | isolated | PASS (`plan-isolation`, plan adapter) | NOT VERIFIED |
| RECENTLY_INCORRECT | A Evidence only | B Evidence must not enter A plan | isolated | PASS | NOT VERIFIED |
| Task lookup | A assigned task | B retrieve/submit | rejected after load | PASS (`integrity` C). SQL get is still id-only | NOT VERIFIED |
| Evidence write | A action | forged ownership | rejected | PASS | NOT VERIFIED |
| Learner update | A Evidence | B model unchanged | isolated | PASS | NOT VERIFIED |
| sessionStorage theft | A opaque id copied to B | no access | `NOT_FOUND` | PASS (same as foreign load) | NOT VERIFIED |

Also verified locally:

- Missing and foreign sessions both return `NOT_FOUND` (no existence oracle on the happy path). Injected `userId` on submit returns `INVALID` before ownership (fail-closed, different status).
- CAS/revision cannot skip ownership (`user_id` is on the update filter).
- Duplicate submit stays on one Evidence for the same user.
- Deterministic task ids still require the owner’s cookie; guessing an id does not authorize.

Concurrent live A+B against Postgres: **NOT VERIFIED**.

## 8. Environment / deployment matrix

| Environment | FREE_PRACTICE_ENABLED | FREE_PRACTICE_RUNTIME | Identity | Expected route |
| --- | --- | --- | --- | --- |
| local test | `1` | `memory` | explicit test gate | available |
| local authenticated | `1` | `supabase` | real cookie session | conditional; no mint in-app |
| Vercel preview current | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** | must stay closed unless verified |
| Vercel production current | **NOT VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** | must remain closed |
| proposed preview | `1` | `supabase` | real approved identity | **rejected by this audit** |

Local code / docs:

- `.env.example` lists names only and says never set these on Vercel.
- Memory is refused on public-host markers.
- E2E probe is local memory only; 404 on supabase and deployed hosts.
- Test identity refused on Vercel production/preview.
- Homepage `primaryHref` is `/train`. No `/practice` link.
- `/train` and Context Lab are unwired to Free Practice.

Vercel CLI is **not linked** in this workspace (`vercel env ls` refused). No env values were printed or changed. Ordinary-host Chromium E2E (PR #10) showed `/practice` 404 when flags are empty; that is local `next start`, not a live Vercel probe.

## 9. Failure / recovery matrix

| Failure | Guarantee | Class |
| --- | --- | --- |
| Supabase client missing | actions `UNAVAILABLE` / `AUTH_NOT_CONFIGURED` | fail closed |
| Identity missing / expired / invalid | `UNAVAILABLE` / `NO_SERVER_SESSION` (no token leak) | fail closed |
| Session missing or foreign | `NOT_FOUND` | fail closed |
| Task missing / mismatched assignment | `NOT_FOUND`; no rewrite | fail closed |
| Malformed / v1 session JSON | `INVALID_STATE` → `INVALID` | fail closed |
| Stale revision | `CONFLICT` or recover settled submit | CAS |
| Duplicate submit | one Evidence; replay feedback | idempotent |
| Evidence written, session CAS fails | reread Evidence by user+lexeme+task; resume `AWAITING_CONTINUE` | eventual recovery |
| Delayed submit after continue | stay on next task; no extra Evidence | idempotent |
| Refresh at AWAITING_ACTION / CONTINUE / COMPLETED | `load` restores the same phase | proven in memory + Chromium |
| Store `NETWORK_ERROR` | **not** mapped to a public DTO; can rethrow | Candidate gap |
| Snapshot write fail after Evidence | Daily Training has `SNAPSHOT_WRITE_FAILED`; FP has no equivalent | Candidate gap |
| Orphan task after failed session save | leftover row possible; do not delete | Candidate gap |
| Cross-user access | must never succeed | local PASS; remote NOT VERIFIED |

This audit did not change the frozen pipeline to close those gaps.

## 10. Evidence

Commands and checks actually performed:

- `git fetch` of squash `3f22005` onto `origin/main`; tree equals `2ca7bad`.
- `git checkout -B audit/free-practice-production-readiness origin/main`
- Read Work Contract, Core V1, Architecture, Learning Task Protocol, DATABASE, Candidate V0, Slice 3A / 3B / 5A / 4, ADR-084.
- Read identity, runtime, actions, session store, plan adapter, task repository, learning repository, homepage paths, migrations, `.env.example`.
- `vercel env ls` → project not linked. No values listed.
- Supabase CLI absent. No `supabase/config.toml`. No remote `db dump` / `db push` / migration history.
- Contract test: `tests/free-practice/production-readiness-audit.test.ts`
- Existing tests cited: `resolve-free-practice-identity`, `identity-architecture`, `runtime-policy`, `plan-isolation`, `supabase-plan-read-adapter`, `supabase-session-store`, `session-foundation`, `evidence-orchestration`, `integrity`, `public-payload-safety`, `direct-ui-architecture`, `direct-ui-runtime`, `direct-ui-hydration-lock`.

No cookies, JWTs, access tokens, or Supabase keys are recorded here.

## 11. Blocking findings

### B1. No real-user identity acquisition

- Severity: **Blocker**
- Evidence: no login UI, no `signInAnonymously`, no `middleware.ts`, docs (“no approved anonymous-account mint”). Work Contract still says student routes use the placeholder; Free Practice rejects that placeholder.
- Risk: enabling supabase `/practice` on preview still leaves visitors unable to start, or tempts a shared/placeholder shortcut.
- Minimum corrective slice: approved Auth path (cookie refresh + explicit mint or login) that never uses `V1_PLACEHOLDER_USER_ID` and never shares one user across browsers.
- Frozen semantics: must **not** change.

### B2. Learner tables have no RLS / client-role lock-down

- Severity: **Blocker**
- Evidence: migrations for `game_sessions`, `learning_tasks`, `learning_evidence`, `student_lexeme_*` never `ENABLE ROW LEVEL SECURITY` and never revoke `anon` / `authenticated`. Data client prefers service-role (`src/lib/supabase/server.ts`).
- Risk: application-layer filters are the only protection. A leaked anon/service key or a missed `.eq("user_id")` exposes all learners.
- Minimum corrective slice: RLS + revoke client roles on learner tables, **or** an equivalent proven lock-down. Service-role path must still bind `user_id` on every get/list/update/CAS.
- Frozen semantics: must **not** change. Schema lock-down is persistence, not evaluator/Evidence meaning.

### B3. Unscoped task evaluation load includes AnswerKey

- Severity: **Blocker**
- Evidence: `SupabaseLearningTaskRepository.getTaskForEvaluation` selects `answer_key` by `id` only. Callers then check assignment.
- Risk: under service-role, the server loads another user’s AnswerKey into process before rejecting. Wrong if logs, errors, or a future caller skip the check.
- Minimum corrective slice: scope the query by server `userId` (and session if available) **before** selecting `answer_key`. Keep in-process checks.
- Frozen semantics: `submitTaskAction` contract stays; only the adapter query tightens.

### B4. Remote schema, grants, and live isolation not verified

- Severity: **Blocker for preview approval**
- Evidence: no CLI project, no config.toml, no authorized remote read.
- Risk: repo SQL and deployed SQL may drift. Isolation proven only in fake clients.
- Minimum corrective slice: authorized read-only migration-history + policy/grant inventory, then live A/B isolation on an isolated project.
- Frozen semantics: must **not** change.

### B5. Current Vercel flag state not verified

- Severity: **Blocker for claiming “already closed”**
- Evidence: Vercel project not linked here. Code defaults closed.
- Risk: preview could already have been enabled out of band.
- Minimum corrective slice: read-only env metadata (present/absent only) and HTTP 404 check on preview/production `/practice`.
- Frozen semantics: must **not** change. Do not set flags in that slice.

## 12. Non-blocking gaps

- `/practice` GET is not an auth gate; actions fail closed instead.
- `requireFreePracticeIdentity` is unused by the live page.
- `isDeployedIdentityRuntime` is exported and unused; live gate is `isFreePracticeTestIdentityAllowed`.
- No cookie-refresh middleware; expired access tokens fail closed.
- `NETWORK_ERROR` and snapshot-after-evidence failure are not mapped to a public Free Practice status.
- Possible orphan `learning_tasks` after a failed session save.
- Deterministic task ids are guessable in principle; authorization still requires the owner (local only).
- Injected `userId` on submit returns `INVALID` rather than `NOT_FOUND` (not an existence leak).
- Memory is allowed on `NODE_ENV=production` if the host is not in the public-host list.
- E2E Chromium covers memory + test identity, not supabase cookies.
- `cleanup_progress_test_user` exists; it is not a product API.

## 13. Explicit non-claims

- Not a Standard.
- Not production-ready.
- Not approved for isolated Vercel preview activation.
- No Homepage integration.
- No migration applied by this audit.
- No Vercel activation or env change.
- No anonymous or shared placeholder identity.
- Local fake-client PASS is not remote isolation.

## 14. Recommended next slice

Do **not** start these in this audit. Priority if a later prompt asks:

1. **Identity acquisition (prerequisite).** Approved cookie session: mint or login + `@supabase/ssr` refresh. Fail closed. No placeholder. No shared user.
2. **Read-only remote inventory.** Migration history, table/RPC/policy/grant check on the authorized project. Record drift. Do not `db push`.
3. **Persistence lock-down.** RLS + revoke client roles on learner tables; keep service-role `user_id` filters; scope `getTaskForEvaluation`.
4. **Live A/B isolation** on an isolated project (not unknown production). Same matrix as §7.
5. **Only then** consider a tightly scoped preview flag review. Homepage stays unwired.

---

Audit performed as investigation only. Candidate status unchanged.
