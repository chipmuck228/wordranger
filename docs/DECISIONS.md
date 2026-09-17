# Architecture Decisions

## ADR-001 — Game does not own learning state

**Status:** accepted

Games may only produce `LearningEvidence`. Mastery, retention, weaknesses, and review times are written exclusively by the Learning Engine. This keeps every future game on the same rules and prevents “the snake game thinks this word is mastered”.

## ADR-002 — Evidence is source of truth

**Status:** accepted

`learning_evidence` is an append-only log of immutable facts. `StudentLexemeModel` is a snapshot. Policy v2 should replay evidence rather than migrate guessed state.

## ADR-003 — Mastery / Retention / Weakness are separate dimensions

**Status:** accepted

A mastered lexeme can still fade and still have a spelling hole. Collapsing those into one enum would force false demotions (one typo dropping `MASTERED` to `RECALLED`) or hide actionable weaknesses.

## ADR-004 — Learning algorithm is policy-driven

**Status:** accepted

Thresholds such as `0.70`, `2 sessions`, and `7 days` live in `LearningPolicy`, not in engine `if` statements. Tests pin behavior to `DEFAULT_LEARNING_POLICY` v1.

## ADR-005 — Learning core is game-agnostic

**Status:** accepted

The core knows skills, prompt modes, and answer modes. It does not import `SnakeGame` or branch on a game title. Games publish `GameCapability`; a future Scheduler matches `LearningNeed` to those capabilities.

## ADR-006 — Event + Snapshot persistence model

**Status:** accepted

Evidence is always stored. The snapshot is stored for cheap reads. In-memory commits are atomic. Supabase V1 writes evidence then snapshot; snapshot failure is rebuildable. A database RPC is the intended later atomic boundary.

## ADR-007 — V1 uses a deterministic rule engine instead of ML/LLM

**Status:** accepted

Junior-high vocabulary practice needs explanations a teacher can inspect: why a lexeme upgraded, why it is fading, why spelling is tagged. V1 therefore uses EWMA scores, explicit stage gates, and rule-based weakness detection. No LLM judge and no Bayesian tracker in this phase.

## ADR-008 — Student learning state attaches to Lexeme, not SourceEntry

**Status:** accepted

A PDF numbered line such as `19 actor / actress` is one `VocabularySourceEntry` and two independently trainable `Lexeme`s. `StudentLexemeModel`, `LearningEvidence`, `Weakness`, and `LearningNeed` bind to `lexemeId`. Binding to source entries would make split lemmas share one mastery score.

## ADR-009 — Vocabulary source / canonical / enrichment are separate layers

**Status:** accepted

Source JSON preserves PDF facts, including errors. Canonical lexemes may correct meaning or split entries. Enrichment (relations, tags) is optional and confidence-scored. Import must not write canonical corrections back into source rows.

## ADR-010 — Relation confidence / provenance controls production usability

**Status:** accepted

`source_structural` is a structural fact. `curated_model` is conservative enrichment. `rule_inferred` is a candidate, not a learning fact. Production `VocabularyRepository.getRelations()` applies `VocabularyContentPolicy` (`source_structural >= 0.95`, `curated_model >= 0.80`, `rule_inferred` disabled). The numeric floors live only in that policy object.

## ADR-011 — wordId renamed to lexemeId

**Status:** accepted

Phase 01 used `wordId` against a placeholder `words` table. Phase 02 performs a clean rename across domain types, repositories, Debug Lab, and SQL (`lexeme_id`, `student_lexeme_models`). Dual fields are not kept.

## ADR-012 — Evidence CORRECT removed to eliminate ambiguous success semantics

**Status:** accepted

`CORRECT` plus `hintCount === 0` was also treated as independent success, overlapping `INDEPENDENT_CORRECT`. V1 outcomes are `INDEPENDENT_CORRECT`, `ASSISTED_CORRECT`, `INCORRECT`, `SKIPPED`, `TIMEOUT`. Independent success with hints, or assisted success with zero hints, is rejected at the evidence boundary.

## ADR-013 — Student snapshot records policyVersion

**Status:** accepted

Each `StudentLexemeModel` stores `policyVersion` from the `LearningPolicy` used by `processEvidence`. This makes it obvious which rule set produced the snapshot when a future policy v2 replays evidence.

## ADR-014 — Games render tasks; games do not grade learning

**Status:** accepted

A Game Renderer displays `PublicLearningTask` and submits `StudentAction`. It must not choose `EvidenceOutcome`, `EvidenceErrorType`, weaknesses, or mastery.

## ADR-015 — PublicLearningTask and TaskAnswerKey are separate

**Status:** accepted

Student clients receive only the public task. Correct option ids and option→lexeme maps stay in `TaskAnswerKey` / `learning_tasks.answer_key`.

## ADR-016 — TaskEvaluator is the only semantic grading path

**Status:** accepted

All games share `DefaultTaskEvaluator`. Correctness, confusion, and spelling diagnosis are protocol concerns, not per-game rules.

## ADR-017 — Production Task Generator consumes only policy-approved vocabulary content

**Status:** accepted

`VocabularyRepository.getRelations()` is always `policy ∩ caller filters`. Caller filters cannot enlarge the set. Raw relations are inspection-only.

## ADR-018 — Task generation is deterministic via injected time and randomness

**Status:** accepted

Generator and evaluator do not call `new Date()` or `Math.random()`. Tests inject `SeededRandomSource` and `request.now`.

## ADR-019 — Audio/context tasks remain unavailable until approved content exists

**Status:** accepted

IPA text and browser TTS are not listening curriculum. LLM sentences are not context curriculum. Those skills return `MISSING_REQUIRED_CONTENT`.

## ADR-020 — One generated task produces one terminal LearningEvidence

**Status:** accepted

`learning_evidence.task_id` is unique when present. Retries must not double-score. Multiple attempts would require an explicit `taskAttemptId` later.

## ADR-021 — LearningEvidence traces to taskId

**Status:** accepted

Task-generated evidence sets `taskId`. Legacy Debug Lab / Phase 01–02 helpers may still use `taskId: null` so existing Learning Core tests stay valid.

## ADR-022 — Relation-choice distractors exclude all other valid answers of the selected relation type

**Status:** accepted

After a `RELATION_CHOICE` relation is chosen, every other production-approved related lexeme of that same type is excluded from distractors. V1 still shows exactly one correct option. Different relation types are not excluded by this rule.

## ADR-023 — Generated tasks are assigned to user + session before evaluation

**Status:** accepted

`LearningTaskRepository.saveGeneratedTask` stores `TaskAssignment` (`userId`, `sessionId`) separately from `PublicLearningTask`. Evaluation loads `AssignedLearningTask` and rejects user/session mismatch.

## ADR-024 — submitTaskAction is the authoritative production submission path

**Status:** accepted

Renderers submit `taskId` + `StudentAction` plus authenticated/session context. The service loads the answer key server-side, grades via `TaskEvaluator`, builds evidence via the factory, and updates learning state via `processEvidence`. Callers cannot supply an answer key or set an outcome.

## ADR-025 — EvidenceFactory validates task/evaluation/key consistency but does not grade

**Status:** accepted

The factory rejects mismatched `taskId`, lexeme, or skill. It does not re-run TaskEvaluator logic.

## ADR-026 — Learning Need Generator and Scheduler are separate responsibilities

**Status:** accepted

The generator answers “what learning needs exist for this student state?” The scheduler answers “which of those needs belong in this session?” Combining them hides blocked pedagogical needs and makes quotas/diversity untestable.

## ADR-027 — Scheduler is deterministic and policy-driven

**Status:** accepted

All numeric behavior lives in `SchedulerPolicy`. Time, ids, and randomness are injected. Same student state, policy, `now`, recent activity, and seed produce the same `LearningSessionPlan`.

## ADR-028 — Scheduler is read-only

**Status:** accepted

The scheduler must not change mastery, retention, weaknesses, or snapshots, and must not create `LearningEvidence`. Only Learning Core mutates learner state.

## ADR-029 — Unsupported content needs remain visible as blocked candidates

**Status:** accepted

V1 content cannot reliably serve `LISTENING_RECOGNITION` or `CONTEXT_USE`. Those pedagogical needs are still generated, then marked `UNSUPPORTED_CONTENT_CAPABILITY` in `SchedulerTrace`. Silent omission would hide the content gap.

## ADR-030 — Session planning uses quotas and diversity, not simple top-N sort

**Status:** accepted

`maxNewWords` and `minReviewNeeds` prevent unseen-word floods. Diversity caps consecutive skill/reason runs, then relaxes rather than returning an undersized plan.

## ADR-031 — LearningNeed deduplicates by lexemeId + targetSkill

**Status:** accepted

Multiple reasons for the same lexeme and skill merge into one need. Primary reason follows explanation precedence; other reasons become `supportingReasons`. Downstream still receives one `LearningNeed`.

## ADR-032 — Scheduler records explainable priority breakdown

**Status:** accepted

Every selected or scored candidate can show reason base, weakness/overdue/fading/skill-gap boosts, confidence, recency penalty, and final score. Unexplained priority numbers are not acceptable.

## ADR-033 — Learning content capability is lexeme-aware, not skill-global

**Status:** accepted

`supports(lexemeId, skill)` is the contract. A skill that is generally teachable can still be infeasible for a specific lexeme (no meaning, no lemma, no production-approved relation). Capability facts are built from `VocabularyRepository`, not by calling Task Generator.

## ADR-034 — Scheduler quotas classify by all merged reasons, not primary reason only

**Status:** accepted

Primary reason remains explanation precedence. `maxNewWords` and `minReviewNeeds` inspect `reason` plus `supportingReasons`, so `USER_MARKED` cannot hide `NEW_WORD` or `REVIEW_DUE`.

## ADR-035 — FADING preserves blocked preferred need and may emit a supported recovery fallback

**Status:** accepted

If FADING prefers an unsupported skill, that candidate stays blocked in the trace. A separate supported recovery fallback may be generated from practiced/supported skills. No fallback is invented when none is feasible.

## ADR-036 — Scheduler capability preparation uses bulk production-approved vocabulary relations

**Status:** accepted

Session planning must not issue one relation query per lexeme. `planLearningSession` loads `listLexemes()` and `listRelations()` once (plus learner models and recent activity), then builds the lexeme capability map in memory in O(L + R). `listRelations()` uses the same `VocabularyContentPolicy` helper as `getRelations()`; caller filters may only narrow. Task Generator may still call `getRelations(lexemeId)` for a single task.

## ADR-037 — Game Renderers consume PublicLearningTask and emit user action only

**Status:** accepted

A renderer displays `PublicLearningTask` and emits choice/text intent. It must not compute `EvidenceOutcome`, `EvidenceErrorType`, weaknesses, or mastery. Task type may change copy, not correctness. Interaction follows `responseContract.kind`.

## ADR-038 — Ranger Trial is the first reference renderer for CHOICE and TEXT_INPUT contracts

**Status:** accepted

Ranger Trial (单词闯关) at `/play/ranger-trial` renders the five executable V1 task types. Later games should be able to replace it without changing Scheduler, Task Generator, TaskEvaluator, or Learning Core.

## ADR-039 — AnswerKey never crosses the server/client boundary

**Status:** accepted

`TaskAnswerKey` is loaded only inside `submitTaskAction`. Client payloads, `sessionStorage`, and renderer props must not contain `answerKey`, `correctOptionIds`, `optionLexemeIds`, `expectedAnswer`, or `semanticAcceptedTexts`. Post-submit `GameSubmissionFeedback.correction` is a safe presentation string computed after evaluation.

## ADR-040 — Game Session Controller orchestrates Scheduler → Task → Submission without owning learning semantics

**Status:** accepted

The controller plans once, generates one assigned task at a time, skips `UNAVAILABLE` needs with a bounded loop, and always grades through `submitTaskAction`. Session stats are UI counts, not learning state. No Ranger Trial tables.

## ADR-041 — Core V1 remains frozen during Renderer integration unless a documented integration blocker is found

**Status:** accepted

Phase 05 must not invent learning architecture. If a renderer cannot consume a frozen contract, document `CORE_INTEGRATION_BLOCKER` instead of silently changing Core. Ranger Trial found none.

## ADR-042 — Student-facing game sessions must use durable server-side persistence

**Status:** accepted

`/play/ranger-trial` production wiring must not keep learning state, assigned tasks, or session orchestration in process-local Maps. Serverless cold starts and different instances load the same session from durable adapters. In-memory repositories remain valid for tests and explicit local fixtures only. Missing Supabase configuration fails closed.

## ADR-043 — Game session persistence stores orchestration state only; learning truth remains in existing Core tables

**Status:** accepted

`game_sessions` is a generic orchestration table (`game_type = RANGER_TRIAL`). It stores the planned needs, navigation, phase, and presentation stats. AnswerKey stays in `learning_tasks`. Evidence stays in `learning_evidence`. `StudentLexemeModel` stays in snapshot tables. Do not create `ranger_trial_*` learning tables.

## ADR-044 — Ranger Trial randomization is derived deterministically from session/need identity, not process-local RNG state

**Status:** accepted

Scheduler seed is `scheduler:${gameType}:${sessionId}`. Task generation seed is `task:${gameType}:${sessionId}:${needId}`. Recreate `SeededRandomSource` per call. Do not persist the RandomSource object and do not reuse one global seed for every session.

## ADR-045 — Game submission/session transition must be idempotent across retries and cold starts

**Status:** accepted

Evidence uniqueness remains the concurrency guard (`learning_evidence.task_id` unique; duplicate maps to `TASK_ALREADY_COMPLETED`). If Evidence succeeds and session save fails, retry recovers `awaiting_continue` once using `lastCompletedTaskId` so presentation stats are not double-counted. Continue while `awaiting_action` returns the current task and does not skip a need.

## ADR-046 — game_sessions uses optimistic concurrency revision instead of last-write-wins

**Status:** accepted

`game_sessions.revision` starts at 0 on insert. Updates succeed only when the stored revision matches the loaded record, then increment by 1. Zero-row CAS is `SESSION_CONFLICT`. Do not upsert existing rows. The token is persistence metadata, not `stateVersion` or scheduler policy version.

## ADR-047 — continue/resume claim orchestration state before task generation

**Status:** accepted

The first persist of a continue (index increment, `currentTaskId` null, `awaiting_action`) is the concurrency gate. Only the winning revision may generate the next task. Resume generation of a missing current task also CAS-claims first. Losers reload; they must not publish a second competing `PublicLearningTask`.

## ADR-048 — SESSION_CONFLICT is recoverable through bounded reload, not hidden by unconditional retry

**Status:** accepted

Controllers reload at most once (or twice for an `awaiting_continue` retry). If the latest durable session already has the current task, feedback, or completion, return that. If another request is still generating, return `SESSION_CONFLICT` to the client. Do not spin the server.

## ADR-049 — Second renderer validates PublicLearningTask portability

**Status:** accepted

Word Bubble consumes the same `PublicLearningTask` / `StudentAction` / `submitTaskAction` / `TaskEvaluator` path as Ranger Trial. Presentation may differ; grading, mastery, and weakness semantics must not. A distinct `gameId` (`WORD_BUBBLE`) is evidence metadata only.

## ADR-050 — Game compatibility filtering occurs after Scheduler, not inside Scheduler

**Status:** accepted

`DeterministicScheduler` remains game-agnostic. After it returns an ordered `LearningNeed` list, application orchestration may drop needs the current renderer cannot serve. Retained needs keep relative priority order. Exclusions are developer traces (`GAME_CAPABILITY_UNSUPPORTED`), not student-facing Scheduler policy.

## ADR-051 — Shared game-session orchestration is extracted only after two real renderers

**Status:** accepted

Phase 06 extracts proven common behavior into `LearningGameSessionController`: plan, filter, generate, assign, persist, resume, submit, CAS, stats, feedback. Ranger Trial becomes a definition + renderer. Do not keep a second orchestration pipeline. Do not invent a speculative multi-game framework beyond what both renderers use.

## ADR-052 — Renderer animation/layout state is ephemeral and not persisted

**Status:** accepted

`game_sessions.state` stores orchestration only. Bubble positions, velocity, animation frames, and CSS are rebuilt on render from a deterministic `bubble-layout:${taskId}` hash. Refresh restores the current task, not the previous pixels.

## ADR-053 — Word Bubble V1 supports CHOICE only

**Status:** accepted

`WORD_BUBBLE_CAPABILITY` plus `responseContract.kind === "CHOICE"` is the renderer contract. V1 tasks are `MEANING_CHOICE`, `RELATION_CHOICE`, and `CONFUSABLE_CHOICE`. TEXT_INPUT is `GAME_CANNOT_RENDER_TASK`. No bubble-specific task types.

## ADR-054 — Composite renderer interaction may produce one semantic StudentAction

**Status:** accepted

Matching V1 requires two UI gestures (left target, then right candidate) before emitting `{ kind: "CHOICE", optionId }`. The first gesture is renderer-local. The learning system still receives one completed semantic answer. Gesture count is not Evidence count.

## ADR-055 — Partial renderer interaction state is ephemeral and never learning truth

**Status:** accepted

`selectedTarget`, a pre-submit `selectedOptionId`, hover, connector stroke, and card animation stay in the Matching renderer. They are not written to `game_sessions`. Refresh may reset a partial pair. The current `PublicLearningTask` and session progress remain.

## ADR-056 — Matching V1 preserves one-task-one-terminal-evidence

**Status:** accepted

Matching does not treat an 8-pair board as one learning task. One `GeneratedLearningTask` still yields one terminal `StudentAction`, one `TaskEvaluation`, and one `LearningEvidence`. Left click, right-before-left, and failed partial selection create no Evidence.

## ADR-057 — Matching reuses CHOICE semantics instead of introducing pair-specific grading

**Status:** accepted

The left target is presentation of the existing public prompt. The selected right card is the existing CHOICE `optionId`. No `PAIR` StudentAction, no `MATCHING_TASK`, and no Matching-specific TaskEvaluator path. `gameId = MATCHING` is provenance metadata only.

## ADR-058 — Renderer interaction count and learning action count are independent

**Status:** accepted

A renderer may use 0, 1, 2, or many visual gestures. Semantic submission remains one `StudentAction` unless the underlying task protocol explicitly defines otherwise. Word Bubble is one tap → one action. Matching is two taps → one action. Core V1 does not count clicks.

## ADR-059 — Real-time game loops remain renderer-local

**Status:** accepted

Snake ticks, direction changes, wrap-around, and self-collision handling live in `snake-engine.ts`. They are not learning events. The Learning Core never sees a game loop.

## ADR-060 — Only semantic collision emits StudentAction

**Status:** accepted

Arrow keys, WASD, screen buttons, ticks, and empty-cell movement emit nothing. The first option-object collision emits `{ kind: "CHOICE", optionId }` and locks further collisions. Wall wrap and self-overlap create no Evidence.

## ADR-061 — Snake V1 preserves one-task-one-terminal-evidence

**Status:** accepted

One `PublicLearningTask` maps to one board and one option collision. After feedback, Continue loads a new task and a new board. Do not keep a multi-question continuous snake world in V1.

## ADR-062 — Snake board state is ephemeral and not persisted

**Status:** accepted

`game_sessions` stores orchestration only. Snake body, direction, pending turn, tick count, option coordinates, and pause are rebuilt from `task.id` on refresh. The current `PublicLearningTask` remains.

## ADR-063 — Snake responseTimeMs includes interaction overhead and is not directly cross-renderer comparable

**Status:** accepted

Snake starts the timer when the task is interactable and stops at option collision. Navigation time is included. Ranger Trial tap time and Snake path time are not the same measurement. Core V1 still stores `responseTimeMs` and may emit `SLOW_RESPONSE` from `detect-weaknesses` using `slowResponseFallbackMs` (8000) or 1.8× the median of prior successful samples. This is `GAME_INTERACTION_LATENCY_CONFOUND` / `CORE_MEASUREMENT_CONCERN`. Do not add Snake-specific scoring or change Core thresholds in Phase 08.

## ADR-064 — Student-game persistence is bounded

**Status:** accepted

No student-facing game operation may wait forever on PostgREST or session/task/learning adapters. The shared policy lives in `withPersistenceTimeout` / `createTimedFetch`, applied to the Supabase server client and `LearningGameSessionController` repository awaits. A stall is `NETWORK_ERROR`, not a renderer-specific wrapper. Client loading timeouts are secondary and do not prove the server failed; retrying start can create a second session. `RANGER_TRIAL_RUNTIME=memory` remains the explicit fixture flag; `GAME_RUNTIME=memory` is an alias. Production stays on durable Supabase.

## ADR-065 — Daily Training is product orchestration, not a fifth renderer

**Status:** accepted

今日训练 sits above `LearningGameDefinition`. It does not introduce `DAILY_TRAINING` as an Evidence `gameId` or a new capability. Games remain execution modes. The student-visible product is one training round on `/train`.

## ADR-066 — One LearningSessionPlan drives one Daily Training round

**Status:** accepted

Scheduler runs once at start. The ordered `LearningNeed`s are persisted as orchestration. Do not reschedule independently per renderer or per task. 再来一轮 creates a fresh plan from the updated `StudentLexemeModel`.

## ADR-067 — Renderer selection happens after task generation using PublicLearningTask compatibility

**Status:** accepted

Need → generate one task → inspect the actual public contract → choose a compatible renderer. Do not assume `targetSkill` uniquely determines the game, and do not generate four candidate tasks.

## ADR-068 — Renderer selection is deterministic application policy, not Scheduler policy

**Status:** accepted

`selectRendererForTask` lives in `src/server/training`. Scheduler scoring, quotas, and LearningNeed semantics stay frozen. Selection uses registry `canRenderTask`, a stable preference order, and a secondary diversity cap. No `Math.random`, no student game-preference model.

## ADR-069 — Selected renderer is persisted per exposed task and stable across refresh

**Status:** accepted

Once a task and renderer are shown, resume restores that pair. Renderer-local ephemeral state (Snake board, Matching partial selection, Bubble pixels) may reset. No extra Evidence is created.

## ADR-070 — Daily Training Evidence records the actual renderer gameId

**Status:** accepted

Submit passes `RANGER_TRIAL` / `WORD_BUBBLE` / `MATCHING` / `SNAKE`. Product correlation uses `game_sessions.id` (`game_type = DAILY_TRAINING`) as `session_id`. Do not write `DAILY_TRAINING` onto Evidence.

## ADR-071 — Free Play and Daily Training feed the same learner model

**Status:** accepted

Direct `/play/*` routes keep producing normal Evidence. Daily Training does not own a parallel weak-word or mastery store. One Learning Core, one `StudentLexemeModel`.

## ADR-072 — UNSEEN means unobserved, not unknown

**Status:** accepted

`MasteryStage.UNSEEN` / missing `StudentLexemeModel` means the system has no evidence. It is not a claim that the student cannot recognize the word. First contact is a normal probe task, not a placement exam and not a client-side mastery shortcut.

## ADR-073 — Scheduler v2 defers healthy STAGE_PROGRESS until review is due

**Status:** accepted

`DEFAULT_SCHEDULER_POLICY` is v2. `SCHEDULER_POLICY_V1` keeps the previous generator behavior. After an independent success, Core still promotes `UNSEEN` → `EXPOSED` and sets `nextReviewAt`. v2 omits healthy same-skill `STAGE_PROGRESS` until that review is due so a few early probes cannot block new-word admission. Incorrect, assisted, and weakness results are not deferred. `sourceIndex` remains source-list order, not difficulty. One multiple-choice success does not grant `MASTERED`.

## Additional notes

- The `LearningRepository` and `VocabularyRepository` *interfaces* live in domain so engines do not import Supabase. Server files implement the ports.
- `LearningPolicy` includes a `confidence` section so confidence math is also policy-driven.
- Vitest 3 is used instead of Vitest 5 because Vitest 5 pulled a broken rolldown native binding in this environment.
- Extra engine helpers (`math.ts`, `time.ts`, `evidence-helpers.ts`, `validate-evidence.ts`) keep the named engine files focused and pure.
- The Debug Lab form uses native `<select>` for dense enum fields, plus shadcn Button/Card/Input/Label/Badge.
- Import IDs are deterministic UUID v5-style values derived from canonical keys, so re-import matches existing rows.
