# Free Practice Slice 3A — Session foundation

> Status: **Candidate / Not a Standard**
>
> This note records what Slice 3A implemented. It is not a product
> Standard and is not production-ready.

Slice 3A adds a server-only session foundation under
`src/server/free-practice/session/`.

It does:

- resolve identity through the approved Slice 1 boundary
- call Slice 2 `planFreePractice` once
- create one `game_sessions` row when the plan is `READY` or `PARTIAL`
- pin `FreePracticeItem[]` and lazily issue the current task
- resume the same owned session / revision / task
- reuse existing `game_sessions` revision CAS
- issue the current task with deterministic ids for
  `sessionId + FreePracticeItem.id`, then idempotent
  `ensureAssignedGeneratedTask` (shared server-only helper, not a
  Context Lab product dependency)

It does **not**:

- add a `/practice` route, React page, or client action
- change Homepage or `/train`
- accept student answers
- call `submitTaskAction`, TaskEvaluator, EvidenceFactory, or
  `processEvidence`
- write Evidence or advance to the next item
- persist the TaskGenerator compatibility projection, AnswerKey, or a
  `LearningSessionPlan`

`game_type = FREE_PRACTICE` is an application-layer orchestration
value. No database migration was required or applied.

Multi-item advancement, answer submit, and Evidence belong to Slice 5.
Do not treat this note as “Slice 3 complete”.
