# Learning Task Protocol

This document is the V1 contract between Vocabulary Domain, Task Generator, Game Renderers, TaskEvaluator, and Learning Core.

## Why this protocol exists

Future games (matching, snake, bubbles, detective, boss) are **renderers**. They must not define learning semantics. One `MEANING_CHOICE` can be presented as buttons, a matching board, or a snake target. Correctness, error type, and `LearningEvidence` stay shared.

## Layers

| Layer | Owns |
| --- | --- |
| Vocabulary Domain | What a lexeme is, and which relations/tags are production-approved |
| LearningNeed | Why this lexeme/skill should be practiced now |
| Task Generator | Which concrete task to emit |
| Game Renderer | How the public task is presented; emits only `StudentAction` |
| TaskEvaluator | What the action means (`TaskEvaluation`) |
| Evidence factory | `TaskEvaluation` → `LearningEvidence` |
| Learning Core | How evidence updates `StudentLexemeModel` |

Games do not grade. Games do not set `EvidenceOutcome`, `EvidenceErrorType`, weaknesses, or mastery.

## LearningNeed

A need is a request, not a question. It has `lexemeId`, `targetSkill`, `reason`, optional `weaknessFocus`, prompt preferences, and recent task types to avoid. It must not contain choices, answers, or `gameId`.

Needs in this phase are constructed by tests and the Debug Lab. There is no Scheduler.

## Task Archetype

`TASK_ARCHETYPES` is a declarative registry. V1 types:

- `MEANING_CHOICE` — `MEANING_RECOGNITION`, `WORD_TO_MEANING`, multiple choice
- `ACTIVE_RECALL_TYPING` — `ACTIVE_RECALL`, `MEANING_TO_WORD`, typing only
- `SPELLING_RECALL_TYPING` — `SPELLING_RECALL`, `MEANING_TO_SPELLING`, spelling/text
- `RELATION_CHOICE` — `SEMANTIC_CONNECTION`, production-approved relations
- `CONFUSABLE_CHOICE` — meaning choice that prefers an approved confusable distractor

Multiple-choice cannot prove `ACTIVE_RECALL`. Listening and context archetypes are not registered because the dataset has no approved audio or sentences.

## GeneratedLearningTask

```text
GeneratedLearningTask
  publicTask     → safe for a student client
  answerKey      → server-only
  generationTrace
```

`PublicLearningTask` must not contain `correctAnswer`, `isCorrect`, `answerKey`, `expectedAnswer`, or option `lexemeId`.

`TaskAnswerKey` maps option ids to lexeme ids so a wrong choice can become `CONFUSED_WITH_WORD`.

## StudentAction

The only payload a renderer may submit: `CHOICE` | `TEXT_INPUT` | `SKIP` | `TIMEOUT`, plus `taskId`, `occurredAt`, `responseTimeMs`, `hintCount`. No outcome, error type, or mastery fields.

## TaskEvaluator

Deterministic. No `Date`, `Math.random`, network, LLM, or Supabase.

- Correct + `hintCount === 0` → `INDEPENDENT_CORRECT`
- Correct + `hintCount > 0` → `ASSISTED_CORRECT`
- Wrong → `INCORRECT` (+ `WRONG_MEANING` / `CONFUSED_WITH_WORD` / `SPELLING_*`)
- Skip / timeout map to those outcomes

Mismatched contracts (`CHOICE` task + `TEXT_INPUT` action, bad `optionId`, `taskId` mismatch) are rejected.

Spelling diagnosis uses Levenshtein distance against `TaskEvaluationPolicy.spelling.minorEditDistance`. Active recall is exact normalized lemma match only.

## Evidence factory

`createLearningEvidenceFromTaskEvaluation()` is the only supported way for a renderer path to produce `LearningEvidence`. `gameId` names the renderer. `taskType` is the `LearningTaskType` string (`MEANING_CHOICE`, not `snake-blue-level-3`). `taskId` traces the evidence to `learning_tasks`.

## Policies

`TaskGenerationPolicy` holds option count, candidate pool limit, difficulty clamp, and recent-avoidance window.

`TaskEvaluationPolicy` holds spelling edit distance and text normalization.

Generation uses an injected `RandomSource` and `request.now`. Same need + seed + id factory must reproduce the same public contract.

## Public task vs answer key

Student clients may receive `publicTask` only. `answer_key` stays on the server evaluation path. Debug Lab may display the key because it is a protocol tester, not a student surface.

## Current content capability

**Supported:** meaning, semantic connection (approved relations), active recall typing, spelling from meaning.

**Unavailable:** `LISTENING_RECOGNITION` (no approved audio; IPA and browser TTS are not curriculum audio), `CONTEXT_USE` (no approved sentences). The Learning Core can still represent `USABLE` / `MASTERED`, but this dataset cannot honestly produce those stages. That is a content gap, not an engine bug.

Production generation calls `VocabularyRepository.getRelations()`, which is always `policy ∩ caller filters`. Debug/QA raw relations live on `VocabularyInspectionRepository`.
