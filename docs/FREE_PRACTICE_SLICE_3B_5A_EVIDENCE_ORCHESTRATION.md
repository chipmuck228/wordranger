# Free Practice Slice 3B / 5A — Evidence orchestration

> Status: **Candidate / Not a Standard**
>
> Server-only. Not production-ready. No `/practice` UI. No Homepage
> or `/train` change. Evidence enters the frozen pipeline only
> through `submitTaskAction`. This is not learning completion.

This note records Slice 3B / Slice 5A. It does not change Candidate
status and does not implement Slice 4 UI.

## What landed

On the Slice 3A session foundation, the server now owns:

current assigned task → student intent → frozen `submitTaskAction`
→ Evidence → public inline feedback → continue → next lazy task
→ completion.

Phases replace the Slice 3A `status: active` blob:

- `AWAITING_ACTION`
- `AWAITING_CONTINUE`
- `COMPLETED`

JSON schema version is `fp-session-v2`. Legacy `fp-session-v1` rows
are **rejected fail-closed**. Candidate has no public route, so old
active sessions are not migrated and feedback/stats are never
invented. No database migration: `game_type` remains unconstrained
`text`; phase and stats live in JSON `state`.

## Submit

Controller input is `sessionId`, expected `revision`, current
`taskId`, and a reused `StudentActionIntent` (`CHOICE` |
`TEXT_INPUT`). The server builds the frozen `StudentAction`
(`occurredAt` = server now, `hintCount = 0`). Optional client
`responseTimeMs` is untrusted telemetry only; it is not used for
scoring or authorization.

`submitTaskAction` is the only entry into the learning pipeline:

- `gameId = RANGER_TRIAL` (renderer / Evidence identity)
- `sessionId` = Free Practice session id
- `hintCount = 0`
- server-authoritative `userId`

The controller does not import or call `DefaultTaskEvaluator`,
`EvidenceFactory`, or `processEvidence`. There is no
`FreePracticeEvidence` and no `gameId = FREE_PRACTICE`.

Public feedback is `{ taskId, correct, message }` only. It never
includes AnswerKey, expected text, Evidence, learner state, or
mastery language.

## Evidence / session CAS recovery

Evidence write and session CAS are not one transaction. Recovery
follows Daily Training:

1. Winner saves feedback → loser reloads that feedback.
2. `TASK_ALREADY_COMPLETED` → `getEvidenceForLexeme` (existing
   `LearningRepository` method) → apply stats once → persist
   `AWAITING_CONTINUE`.
3. Evidence exists but session CAS lost → same recovery. Retry
   must not write a second Evidence or increment stats twice.

The client cannot supply an evaluation as a recovery source.

## Continue and completion

Continue accepts `sessionId`, expected `revision`, and the completed
`taskId`. It does not accept the next index, item, or lexeme.

If another item remains, the server increments `currentIndex` once,
clears the previous assignment/feedback, CAS-saves
`AWAITING_ACTION`, then lazily generates the next deterministic
task. Concurrent continue cannot skip an item or leave a second
authoritative task.

The last continue marks `COMPLETED`, sets server `completedAt`, and
returns:

- sessionId, source, plannedCount, attempted, correct
- message: `本组练习完成。完成 N 个。答对 N 个。`

That is not mastery, not “已学会”, and not Daily Training
completion. The next start always re-calls the Slice 2 planner from
the latest learner snapshot / latest 40 terminal Evidence rows. It
does not reuse a completed session’s pinned items.

## Out of scope

- `/practice` route, React page, client state machine
- Homepage link
- `/train` handoff
- Context Lab product coupling
- Playwright E2E
- production feature flag

UI remains future Slice 4.
