# Free Practice Slice 4 — Direct Renderer UI

> Status: **Candidate / Not a Standard**
>
> Not production-ready. Default is closed. Homepage does not link
> `/practice`. `/train` and Context Lab are unchanged. This is not
> learning completion.

This note records the minimal `/practice` page on top of the
server-authoritative Free Practice planner, session, and Evidence
orchestration. It does not change ADR-084 status.

## Feature and runtime

- `FREE_PRACTICE_ENABLED=1` is required. Missing or invalid values
  fail closed. The page returns a real 404 when the flag is off.
- `FREE_PRACTICE_RUNTIME=memory|supabase` is required when the flag
  is on. Missing or illegal values fail closed.
- The policy is independent of `GAME_RUNTIME`, `RANGER_TRIAL_RUNTIME`,
  and Context Lab runtime. There is no silent fallback.
- `memory` is local/test only. Vercel production/preview must refuse
  it.
- Production remains off. Do not set these flags on Vercel.

## Identity

Public hosts may only use the existing cookie `auth.getUser()`
reader. Shared `V1_PLACEHOLDER_USER_ID` is rejected. There is still
no approved anonymous-account mint, so local/E2E uses the existing
`WORD_RANGER_FREE_PRACTICE_TEST_IDENTITY=1` factory plus
`WORD_RANGER_FREE_PRACTICE_E2E=1` on an explicit local host.

Vercel production/preview refuse the test identity even if those
gates are set. Ordinary browser parameters cannot open it.

## Route contract

`/practice` is a thin server page plus server actions:

- `startFreePractice({ source, requestedCount })`
- `loadFreePracticeSession({ sessionId })`
- `submitFreePracticeIntent({ sessionId, revision, taskId, intent, responseTimeMs? })`
- `continueFreePractice({ sessionId, revision, taskId })`

Actions validate input, obtain the server runtime, call
`FreePracticeSessionController`, and return the public DTO. They do
not score, plan, write Evidence, or accept `userId`.

The browser holds only the public result, opaque `sessionId`,
revision, current task/input, and UI state.
`sessionStorage` key `wordranger.free-practice.session-id` stores
the handle only. Refresh calls `load`.

`开始练习` / `再练一组` share the existing `inFlight` lock. A second
click while start is in flight does not call `startFreePractice`.
The start button is disabled once the request is issued. Failure
clears the lock so Retry can start once. The client never generates
or chooses a `sessionId`.

## Isolation

Homepage still links Daily Training (`/train`). `/train` does not
navigate to `/practice`. Context Lab is unchanged. No migration.

## Probe

`/practice/e2e-probe` is Playwright-only memory inspection. It
requires the local E2E probe gate and is 404 everywhere else. It
never returns AnswerKey.
