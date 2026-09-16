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

## Additional notes

- The `LearningRepository` and `VocabularyRepository` *interfaces* live in domain so engines do not import Supabase. Server files implement the ports.
- `LearningPolicy` includes a `confidence` section so confidence math is also policy-driven.
- Vitest 3 is used instead of Vitest 5 because Vitest 5 pulled a broken rolldown native binding in this environment.
- Extra engine helpers (`math.ts`, `time.ts`, `evidence-helpers.ts`, `validate-evidence.ts`) keep the named engine files focused and pure.
- The Debug Lab form uses native `<select>` for dense enum fields, plus shadcn Button/Card/Input/Label/Badge.
- Import IDs are deterministic UUID v5-style values derived from canonical keys, so re-import matches existing rows.
