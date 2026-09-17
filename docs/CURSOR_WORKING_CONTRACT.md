# WordRanger Cursor Working Contract

Durable architecture and development rules. Source of truth is the current repository, especially `docs/ARCHITECTURE.md`, `docs/CORE_V1_BASELINE.md`, `docs/GAME_RENDERER_PROTOCOL.md`, `docs/DECISIONS.md`, `docs/DATABASE.md`, and the tests that enforce those boundaries.

This file is not a phase prompt. Do not put task-specific implementation details here.

## HOW TO USE THIS FILE

Future Cursor prompts should begin with:

> Read and obey `docs/CURSOR_WORKING_CONTRACT.md`.
> Do not re-derive the architecture unless this task explicitly changes the contract.

Then implement only the task-specific requirements.

If the task conflicts with this contract, **stop and report the conflict** before changing frozen semantics.

---

## 1. Project architecture invariants

WordRanger is a learning engine that uses interchangeable games, not a collection of games that own learning.

Canonical pipeline:

```text
Student
  → Daily Training (primary) or Free Play (secondary)
  → Scheduler / LearningSessionPlan
  → TaskGenerator (one task)
  → PublicLearningTask [+ renderer selection in Daily Training]
  → StudentAction
  → submitTaskAction
  → TaskEvaluator
  → LearningEvidence
  → Learning Core
  → StudentLexemeModel
```

Layer ownership:

| Layer | Owns |
| --- | --- |
| Vocabulary Domain | What content exists, which of it is production-approved, and placement/curriculum **reference** metadata (not learner state) |
| StudentLexemeModel | Learner snapshot for one `lexemeId` |
| Need Generator | What pedagogical needs exist |
| Scheduler | Which needs belong in this plan |
| Task Generator | Which task represents a need |
| Task assignment | Which user + session owns the generated task |
| Game Renderer | Presentation of `PublicLearningTask`; student intent only |
| Game Session Controller | Free-play orchestration for one `LearningGameDefinition` |
| Daily Training Controller | Product orchestration above any one game definition |
| `submitTaskAction` | Load AnswerKey, verify ownership, grade, write evidence |
| TaskEvaluator | Semantic correctness |
| Learning Core | How evidence changes the snapshot |

Hard rules:

- Games never write mastery, never grade, never receive `TaskAnswerKey` on the production path.
- Scheduler never mutates learning state and never generates tasks.
- Student state binds to `lexemeId`, never to a source entry.
- `gameTags` describe data capabilities; they do not choose the next game.
- No student login. Student routes use `V1_PLACEHOLDER_USER_ID`. Server actions must not accept `userId` from the browser.
- Daily Training (`/train`) is the primary student path. Free-play `/play/ranger-trial`, `/play/word-bubble`, `/play/matching`, `/play/snake` remain. Both paths write the same Evidence / `StudentLexemeModel`.
- Daily Training is **not** a fifth renderer. `game_sessions.game_type = DAILY_TRAINING` is orchestration identity only. `Evidence.gameId` is the actual renderer: `RANGER_TRIAL`, `WORD_BUBBLE`, `MATCHING`, or `SNAKE`.

Forbidden dependency directions:

- `domain/learning` → games or Supabase
- `domain/scheduler` → Task Generator, TaskEvaluator, or `submitTaskAction`
- Game / training UI → `TaskAnswerKey`, `LearningRepository`, `submitTaskAction`, Scheduler, TaskEvaluator
- Games querying Supabase vocabulary tables directly

Student-path vocabulary is the bundled JSON dataset. That is immutable reference data, not learner state.

---

## 2. Frozen Core V1 boundaries

Core V1 is frozen. Game, runtime, and product work consume it.

Do not change without an explicit contract-changing task and a documented `CORE_INTEGRATION_BLOCKER` or new ADR:

- `MasteryStage` / `RetentionState` / Weakness semantics
- `LearningEvidence` / `LearningNeed` semantics
- Scheduler scoring, quotas, diversity, feasibility
- Task types and TaskEvaluator grading rules
- `VocabularyContentPolicy`
- `processEvidence` using lemma, Chinese meaning, synonym, or antonym to compute mastery

Renderers and product orchestration may display `PublicLearningTask`, emit student intent, and show `GameSubmissionFeedback`. They may not grade, create Evidence, mutate `StudentLexemeModel`, select the next lexeme, or keep a parallel weak-word list.

Persistence adapters (`Supabase*` repositories, `game_sessions`) are outside Core domain semantics. `game_sessions.revision` is an orchestration CAS token, not a Core version.

Snake `responseTimeMs` includes navigation overhead (`CORE_MEASUREMENT_CONCERN` / ADR-063). Do not compare raw response time across renderer types in UI or scheduling. Do not change Core `SLOW_RESPONSE` thresholds to compensate.

`LISTENING_RECOGNITION` and `CONTEXT_USE` stay unavailable until approved audio/context content exists. Do not fake those tasks.

---

## 3. LearningNeed / Scheduler boundaries

Need generation and scheduling are separate. Scheduler is read-only and policy-driven (`DEFAULT_SCHEDULER_POLICY`, currently v2; `SCHEDULER_POLICY_V1` remains available).

Flow: Need Generator → lexeme-aware content capability facts → score → dedup by `lexemeId + targetSkill` → quotas / diversity → `LearningSessionPlan`.

- Plan **once** per free-play session or Daily Training round. Do not reschedule per task or per renderer.
- Persist a copy of planned needs in `game_sessions.state` as **orchestration**, so refresh does not re-run the Scheduler. That copy is not learning truth.
- Game compatibility filtering happens **after** the Scheduler returns ordered needs. The Scheduler stays game-agnostic.
- Capability facts come from bulk `listLexemes()` + `listRelations()` once per plan. No per-lexeme `getRelations()` during planning. No Task Generator probing for feasibility.
- `LearningNeed` is not a task. Downstream generates one task from the current need.
- 再来一轮 / a new free-play session creates a **fresh** plan from the current `StudentLexemeModel`.
- UNSEEN means unobserved (no evidence), not “the student does not know the word.”
- `sourceIndex` is source-list order, not difficulty. Do not build a fake difficulty ladder from it.
- Placement metadata lives in Vocabulary Domain (`listPlacementMetadata()`), not on `StudentLexemeModel` / Evidence / `game_sessions` / `learning_tasks`. Every placement field needs provenance (`SOURCE` / `CURATED` / `EXTERNAL_REFERENCE` / `INFERRED`). `INFERRED` is not production placement authority. Do not rank, skip, or jump Scheduler admission using placement fields until a later reviewed phase.
- Scheduler v2 defers healthy `STAGE_PROGRESS` on a skill that already has independent success until `nextReviewAt`. Failures/assisted/weakness results stay eligible. Do not invent `knownWords` or mark MASTERED from one multiple-choice probe.

---

## 4. PublicLearningTask / StudentAction boundary

Clients receive `PublicLearningTask` only.

They must never receive or persist:

- `TaskAnswerKey` / `answerKey`
- `correctOptionIds`
- `optionLexemeIds`
- `expectedAnswer`
- `semanticAcceptedTexts`
- `exactAcceptedTexts`
- `isCorrect`

Domain `StudentAction` kinds: `CHOICE`, `TEXT_INPUT`, `SKIP`, `TIMEOUT`.

Current student-facing renderers emit only:

```ts
{ kind: "CHOICE", optionId }
{ kind: "TEXT_INPUT", value }
```

The controller attaches `taskId`, server `occurredAt`, `responseTimeMs`, and `hintCount` (`0` in V1). Visual components do not invent `EvidenceOutcome`.

Do not add `PAIR` or other renderer-specific grading actions. Multiple UI gestures or many real-time ticks may collapse to **one** semantic `StudentAction`.

`LearningTaskType` may change copy. It does not change correctness.

---

## 5. TaskEvaluator and Evidence ownership

`submitTaskAction` is the only production grading path. It loads the server-side AnswerKey, checks user/session ownership, evaluates, builds Evidence, then `processEvidence`.

- TaskEvaluator owns correctness. Renderers do not.
- EvidenceFactory validates consistency; it does not grade.
- `LearningEvidence` is an immutable append-only fact. Outcomes: `INDEPENDENT_CORRECT`, `ASSISTED_CORRECT`, `INCORRECT`, `SKIPPED`, `TIMEOUT`. `CORRECT` is not valid.
- Repositories do not implement `updateEvidence`. Postgres rejects mutation of `learning_evidence`.
- `StudentLexemeModel` is a rebuildable projection (`MasteryStage`, `RetentionState`, `Weakness[]`, skill states, review fields, `policyVersion`). Those three dimensions stay separate.
- Session stats (`attempted` / `correct` / `incorrect`) are UI counters, not learning truth.

---

## 6. One-task-one-terminal-Evidence rule

One generated task → one assignment (`userId` + `sessionId`) → one terminal student action → one `TaskEvaluation` → one terminal `LearningEvidence`.

- `learning_evidence.task_id` is unique when not null.
- Duplicate submit maps to `TASK_ALREADY_COMPLETED` / `DUPLICATE_TASK_EVIDENCE` and must not write a second Evidence.
- Daily Training completion does not create aggregate Evidence.
- Renderer interaction count is independent of learning action count.

---

## 7. Renderer rules

A renderer displays `PublicLearningTask` and emits student intent. It does not own learning.

Current reference renderers:

| Renderer | Route | Contracts | Interaction |
| --- | --- | --- | --- |
| Ranger Trial | `/play/ranger-trial` | `CHOICE` + `TEXT_INPUT` | option tap or typed submit |
| Word Bubble | `/play/word-bubble` | `CHOICE` only | single tap |
| Matching | `/play/matching` | `CHOICE` only | left target, then right candidate |
| Snake | `/play/snake` | `CHOICE` only | real-time loop; only option collision is semantic |

- Do not copy renderer implementations into a universal game component. Thin adapters are allowed.
- Renderer-local state is ephemeral: bubble layout, Matching partial selection, Snake body/direction/ticks. Refresh may reset it. No extra Evidence.
- Typing tasks must go to a renderer that truly supports `TEXT_INPUT` (Ranger Trial today). Do not force typing into Bubble / Matching / Snake.
- Daily Training stays on `/train` and dispatches existing renderer components. Do not navigate `/play/*` per item.
- Renderer selection is application policy after **one** task is generated from the current need. Inspect `PublicLearningTask`, not AnswerKey, not `targetSkill` alone. Do not generate one candidate task per game.
- Selection is deterministic (`selectRendererForTask`). No `Math.random`. No student game-preference model. Compatibility and plan order beat diversity.
- Once a task + renderer are exposed, refresh restores that pair.
- Same task + same action → same `TaskEvaluation` regardless of which compatible renderer presented it.

---

## 8. GameCapability rules

`GameCapability` answers: can this renderer **display** this task?

It does not answer what the student should practice (Scheduler) or whether the answer is correct (TaskEvaluator).

`LearningGameDefinition` is `{ gameType, gameId, capability, canRenderTask, requestedNeedCount }`. Reuse it. Do not duplicate capability declarations.

`canGameRenderTask` checks skill, prompt mode, answer mode, difficulty, and `CHOICE` / `TEXT_INPUT`. Word Bubble, Matching, and Snake additionally require `CHOICE`. Unsupported free-play tasks fail with `GAME_CANNOT_RENDER_TASK`. Daily Training with zero compatible renderers fails with `NO_COMPATIBLE_RENDERER` (Ranger Trial is the compatible fallback for current supported types).

Filtered needs keep Scheduler order. Exclusions are `GAME_CAPABILITY_UNSUPPORTED`. Non-empty plan with nothing playable is `NO_PLAYABLE_NEEDS`.

---

## 9. Generic game-session runtime rules

Free play uses `LearningGameSessionController` + a `LearningGameDefinition`. Daily Training uses `DailyTrainingController` above any one definition. Do not force Daily Training through one fixed game definition.

Shared orchestration:

1. Plan once.
2. Filter / select presentation without changing need semantics.
3. Generate **one** assigned task at a time (lazy).
4. Return `PublicLearningTask` only.
5. Submit through `submitTaskAction` with the **actual renderer** `gameId`.
6. Map outcome to `GameSubmissionFeedback` (presentation only).
7. Continue to the next planned need.

`UNAVAILABLE` generation skips that need with a bounded loop and records a developer trace. Do not convert the task into another learning type.

Randomization is derived from session/need/task identity (`scheduler:…`, `task:…`, `bubble-layout:${taskId}`). Do not persist the RandomSource object.

Production student routes use durable Supabase adapters. Debug Labs and unit tests may use in-memory repositories. `RANGER_TRIAL_RUNTIME=memory` (alias `GAME_RUNTIME=memory`) is the explicit local/e2e fixture. Production must leave both unset and must not silently fall back to Maps. Missing Supabase config fails closed.

---

## 10. Persistence / CAS / idempotency rules

Five kinds of data stay separate. Do not collapse them.

| Store | Holds | Does not hold |
| --- | --- | --- |
| Vocabulary files / tables | Source, canonical, enrichment | Student state |
| `learning_tasks` | Public task + server AnswerKey + assignment | Session progress |
| `learning_evidence` | Immutable grading facts | UI counters |
| `student_lexeme_models` | Core snapshot | Game orchestration |
| `game_sessions` | Resume/navigation, planned needs, phase, stats, last safe feedback, selected renderer | AnswerKey, Evidence copies, `StudentLexemeModel` |

- Prefer reusing `game_sessions` for product sessions. A new learning table needs an explicit justification in `docs/DATABASE.md` before a migration.
- `revision` CAS: insert at `0`; update `WHERE revision = N` writes `N+1`. Stale write is `SESSION_CONFLICT`. Never last-write-wins.
- `revision` is not `stateVersion`, not scheduler `policyVersion`, and is not sent to the browser.
- Continue / resume **claim** orchestration state before generating the next task. Two concurrent continues must not publish two `currentTaskId`s.
- Evidence success + session-save failure recovers onto `awaiting_continue`. Stats increment once via `lastCompletedTaskId`.
- Do not delete orphan `learning_tasks` if session save fails after insert.
- Browser may store `sessionId` (and Daily Training round-complete flags) in `sessionStorage`. It must not store the plan, AnswerKey, model, Evidence, or renderer-local layout.
- Start retry after a client timeout may still create a second session. Do not silently redesign that unless the task requires it.

---

## 11. Runtime timeout / failure handling rules

No student-facing operation may wait forever.

- Server: `withPersistenceTimeout` / `createTimedFetch` (default 8s). Stalls map to `NETWORK_ERROR`.
- Client: `withClientGameTimeout` (12s) around Server Actions. This does **not** cancel server work. Ignore late results after leaving the loading screen.
- Student UI shows Chinese copy, never raw codes (`NETWORK_ERROR`, `SESSION_CONFLICT`).
- Error actions: retry + back. Do not leave “正在准备…” forever.
- Daily Training student start/network copy: “暂时没能准备好今天的训练，请稍后再试。”

---

## 12. Client payload safety rules

Start / submit / continue / resume payloads to the browser: `PublicLearningTask` + safe session/progress/feedback only.

Feedback DTO after evaluation:

```ts
{
  status: "CORRECT" | "ASSISTED" | "INCORRECT" | "SKIPPED" | "TIMEOUT";
  message: string;
  continueAvailable: boolean;
  correction?: { text: string };
}
```

`INDEPENDENT_CORRECT` → `CORRECT`. `ASSISTED_CORRECT` → `ASSISTED`. Correction text is computed **after** evaluation. It is not the AnswerKey.

Do not `select("*")` `learning_tasks` from a browser client.

---

## 13. Testing expectations

During development: targeted tests for the files you change.

Before the final report, run the actual suite and report those numbers only:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

If vocabulary content/policy is touched: run the existing vocabulary validation command.

Preserve and extend, do not weaken:

- Renderer / Daily Training import boundaries (`tests/game/architecture.test.ts`)
- Scheduler import boundary (`tests/scheduler/import-boundary.test.ts`)
- Payload AnswerKey absence (`tests/game/payload-safety.test.ts`, Daily Training D88)
- Production wiring: student actions go through runtime selectors, not in-memory stores
- One Evidence on concurrent/duplicate submit
- CAS / double continue / resume restores the same task
- Free-play renderer regressions remain valid when product work lands
- Daily Training: one plan, actual renderer `gameId`, renderer stable across resume

E2E: `GAME_RUNTIME=memory` or legacy `RANGER_TRIAL_RUNTIME=memory`. Do not make E2E depend on `Math.random` or live Supabase.

Do not add tests that require Core, Scheduler, or evaluator behavior changes unless the task explicitly changes those contracts.

---

## 14. Documentation / ADR expectations

When a durable rule changes, update the matching doc in the same change:

- Architecture / pipeline → `docs/ARCHITECTURE.md`
- Frozen Core → `docs/CORE_V1_BASELINE.md`
- Scheduler policy versions → `docs/LEARNING_SCHEDULER.md` and `docs/DECISIONS.md`
- Renderer / session protocol → `docs/GAME_RENDERER_PROTOCOL.md`
- Tables / what may live in `game_sessions.state` → `docs/DATABASE.md`
- Student-facing Daily Training flow only → `docs/DAILY_TRAINING_EXPERIENCE.md`
- Decisions → append the next ADR in `docs/DECISIONS.md` (next number after the last existing ADR). Do not renumber.

Do not rewrite frozen Core docs to justify a renderer shortcut.

Student copy stays simple Chinese. Do not expose Scheduler, LearningNeed, mastery, retention, or weakness enums in student UI.

---

## 15. Token-efficient Cursor working rules

- Do not restate task prompts.
- Do not scan the entire repository by default.
- Read only files required for the task and their direct dependencies.
- Reuse this contract instead of re-deriving architecture.
- Do not create speculative abstractions unless required by the task.
- Use targeted tests during development.
- Run the full required verification suite once before the final report.
- Keep final reports concise.
- Report actual test results only.
- If a requested change conflicts with this contract, stop and report the conflict before modifying frozen semantics.

Also:

- Use actual current type and file names from the repo.
- Do not implement auth, streaks, XP, shops, dashboards, or AI content unless the task explicitly asks.
- Do not change application behavior while only adding documentation.
- Prefer the smallest correct layer: product orchestration above games, games above Core — never the reverse.
