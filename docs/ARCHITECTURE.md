# WordRanger Architecture

WordRanger is a game-based vocabulary learning platform for junior-high students. Phase 05 adds **Ranger Trial** (单词闯关), the first Game Renderer that consumes Core V1. There is still no student login.

## Formal layers

```mermaid
flowchart TD
  vocab[Vocabulary Domain]
  model[StudentLexemeModel]
  generator[Learning Need Generator]
  candidates[LearningNeedCandidate]
  scheduler[Deterministic Scheduler]
  plan[LearningSessionPlan]
  need[LearningNeed]
  gen[Task Generator]
  generated[GeneratedLearningTask]
  assignment[Task Assignment / Persistence]
  publicTask[PublicLearningTask]
  renderer[Game Renderer]
  action[StudentAction]
  sessionCtl[Game Session Controller]
  submit[submitTaskAction]
  answerKey[server-side TaskAnswerKey]
  evaluator[TaskEvaluator]
  evidence[LearningEvidence]
  core[Learning Core]

  vocab --> model
  model --> generator
  generator --> candidates
  candidates --> scheduler
  scheduler --> plan
  plan --> need
  need --> gen
  gen --> generated
  generated --> assignment
  assignment --> publicTask
  publicTask --> renderer
  renderer --> action
  action --> sessionCtl
  sessionCtl --> submit
  assignment --> answerKey
  answerKey --> submit
  submit --> evaluator
  evaluator --> evidence
  evidence --> core
  core --> model
```

```text
StudentLexemeModel
        ↓
Need Generator
        ↓
Scheduler
        ↓
LearningNeed
        ↓
Task Generator
        ↓
Task Assignment
        ↓
PublicLearningTask
        ↓
Game Renderer
        ↓
StudentAction
        ↓
Game Session Controller
        ↓
submitTaskAction
        ↓
TaskEvaluator
        ↓
LearningEvidence
        ↓
Learning Core
        ↓
StudentLexemeModel
```

Responsibilities:

- **Vocabulary Domain** — what content exists, and which of it is production-approved
- **StudentLexemeModel** — current learner state for one lexeme
- **Learning Need Generator** — what learning needs exist for this student
- **Deterministic Scheduler** — which needs should happen now
- **LearningNeed** — stable contract passed downstream; not a task
- **Task Generator** — which task should represent the need
- **Task Assignment** — which user/session owns the generated task
- **Game Renderer** — how the public task is presented; emits only student action intent
- **Game Session Controller** — plans once, generates one assigned task at a time, calls `submitTaskAction`, returns a safe feedback DTO
- **Submission Service** (`submitTaskAction`) — loads the server-side answer key, verifies ownership, then grades
- **TaskEvaluator** — what the student action means
- **LearningEvidence** — the immutable fact
- **Learning Core** — how evidence changes the student model

Games never write mastery. Games never grade. Games never receive `TaskAnswerKey` on the production path. The scheduler never mutates learning state and never generates tasks.


## Vocabulary Domain

A PDF numbered entry is a `VocabularySourceEntry`. It is source fact, not a learning-state entity.

Example: source `#19 actor / actress` is one source entry and two trainable `Lexeme`s (`actor`, `actress`). Student state binds to `lexemeId`, never to a source entry.

`LexemeRelation` and `LexemeTags` form the word graph / enrichment layer. Relation `confidence` and `provenance` control production usability via `VocabularyContentPolicy`. `gameTags` describe data capabilities; they do not choose the next game.

## Learning Core

The Learning Core is game-agnostic and does not import React, Supabase, or concrete games:

- Games emit `LearningEvidence`
- `processEvidence` is the orchestration entry
- Pure engine functions update `SkillState`, weaknesses, `MasteryStage`, `RetentionState`, scores, and review time
- `StudentLexemeModel` is the derived snapshot, keyed by `lexemeId`, and records `policyVersion`

Invariant: **games never write mastery state**. There is no `student.masteryStage = "RECALLED"` API.

`processEvidence` must not read lemma, Chinese meaning, synonym, or antonym to compute mastery. Those belong to Vocabulary Domain.

## Evidence

`LearningEvidence` is an immutable fact in an append-only event log. Outcomes are:

- `INDEPENDENT_CORRECT` — correct with no hint/scaffold (`hintCount` must be 0)
- `ASSISTED_CORRECT` — correct after hint/scaffold (`hintCount` must be > 0)
- `INCORRECT` / `SKIPPED` / `TIMEOUT`

`CORRECT` is not a valid outcome. Boundary validation rejects contradictory evidence.

If the scoring policy changes from v1 to v2, snapshots can be rebuilt from the original evidence. Each snapshot stores the `policyVersion` used to produce it.

## StudentLexemeModel

`StudentLexemeModel` is a projection:

- `MasteryStage` — how deeply the lexeme has been learned
- `RetentionState` — how stable the memory currently is
- `Weakness[]` — specific holes such as spelling or confusion (`relatedLexemeId`)
- per-skill `SkillState`
- review scheduling fields
- `policyVersion`

These three dimensions stay separate. A lexeme may be `MASTERED`, `FADING`, and have a `SPELLING` weakness at the same time. Word-graph fields do not belong on this snapshot.

## GameCapability

Games describe what they can train (`supportedSkills`, prompt/answer modes, weakness types, difficulty range). The engine does not hard-code `SnakeGame` or `MatchingGame`. Capabilities do not list lexemes. Ranger Trial publishes `RANGER_TRIAL_CAPABILITY` for display feasibility only.

## Scheduler

Need generation and scheduling are separate:

1. Generator emits `LearningNeedCandidate[]` from vocabulary + `StudentLexemeModel` + user marks
2. Vocabulary Domain → content capability facts → Scheduler feasibility filter (lexeme-aware)
3. Scoring produces an explainable `PriorityBreakdown`
4. Dedup merges `lexemeId + targetSkill`
5. Quotas classify by **all merged reasons**; diversity uses primary reason
6. `LearningSessionPlan`

The scheduler does not call Task Generator to test feasibility. Content capability is computed on the application side from bulk `VocabularyRepository` reads and passed in as facts.

```text
VocabularyRepository
  → listLexemes()
  → listRelations()
  → in-memory capability map
  → Scheduler
```

Session planning loads lexemes once and production-approved relations once, then builds the lexeme capability map locally. There is no per-lexeme `getRelations()` during planning.

The scheduler is read-only and policy-driven (`DEFAULT_SCHEDULER_POLICY` v1). Scheduler output is still generated on demand; Ranger Trial persists a copy of the planned `LearningNeed`s as **game orchestration** so a cold start does not re-plan. That copy is not learning truth. See `docs/LEARNING_SCHEDULER.md`.

`LearningNeed.lexemeId` remains the protocol later game selection will match against `GameCapability`. Phase 04 does not select games.

## Dependency rule

Allowed:

- `games → domain/learning` types for `PublicLearningTask` / skills (display only)
- `task generator / debug UI / game session controller → domain/vocabulary` (via `VocabularyRepository`)

Forbidden:

- `domain/learning → games`
- `domain/learning → supabase`
- games querying Supabase vocabulary tables directly
- `domain/vocabulary` containing scheduler policy
- `domain/scheduler` importing Task Generator, TaskEvaluator, or `submitTaskAction`
- Game Renderers importing `TaskAnswerKey`, `LearningRepository`, or `submitTaskAction`

UI, API routes, and repositories contain no stage-transition rules. Those live in `src/domain/learning/engine`. Scheduler numeric behavior lives in `SchedulerPolicy`. See `docs/GAME_RENDERER_PROTOCOL.md` and `docs/CORE_V1_BASELINE.md`.

## Runtime today

```text
browser
  → Ranger Trial Server Action
  → RangerTrialSessionController
  → durable Game Session (`game_sessions`, revision CAS)
  → one authoritative session transition
  → durable LearningTask assignment (`learning_tasks`)
  → durable learner state (`student_lexeme_models` + `learning_evidence`)
  → submitTaskAction
  → TaskEvaluator
  → LearningEvidence
  → Learning Core
```

Student-facing `/play/ranger-trial` production wiring uses `createSupabaseRangerTrialRuntime()`: `SupabaseLearningRepository`, `SupabaseLearningStateQueryRepository`, `SupabaseLearningTaskRepository`, and `SupabaseRangerTrialSessionStore` share one server Supabase client. Session writes are `INSERT` on create and revision CAS on update. There is no production in-memory Map for learning state, assigned tasks, or session orchestration.

Vocabulary on the student path is the bundled JSON dataset (`InMemoryVocabularyRepository` over git-versioned files). That is immutable reference data, not learner state.

Debug Labs and unit tests may still use in-memory repositories. Explicit `RANGER_TRIAL_RUNTIME=memory` is a local/e2e fixture only. Missing Supabase config in production fails closed.

There is no auth; Ranger Trial uses `V1_PLACEHOLDER_USER_ID` (a UUID placeholder). Auth/RLS is future work. Server actions must not accept `userId` from the browser.

