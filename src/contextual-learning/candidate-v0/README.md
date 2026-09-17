# Contextual Learning Domain — Candidate V0

**Status: Candidate / Experimental / Not a Standard.**

This module is an adapter spike. It is not a project standard and is not part of the stable public API.

## Where it sits

```text
LearningNeed  →  LearningExperiencePlan / ExperienceStepSpec
                 → compileExperienceStep
                 → frozen PublicLearningTask
                 → frozen StudentAction / TaskEvaluator / LearningEvidence
```

The candidate layer may choose a skeleton, frame, semantic steps, support blocks, and required runtime capabilities.

It does **not** decide correctness, invent evidence, or update `StudentLexemeModel`.

## Fixtures

| Case | Skeleton | What it proves |
| --- | --- | --- |
| Meal | `meal-setting-v0` | One skeleton, three frames. `SUITABLE_FOR` is a contextual fact, not a universal lexical truth. |
| School Challenge | `goal-directed-challenge-v0` | Abstract words bind as property / action / state / outcome / grounded claim. Local success is not general ability. |
| Borrowing-Sharing | `temporary-resource-access-v0` | Same transfer event; requester perspective is `borrow`, owner perspective is `lend`. Ownership stays; possession moves. |

Each case has three `ContextFrame`s plus BUILD and STRENGTHEN plans.

## Runtime capabilities actually registered

Drawn from frozen `PublicLearningTask` + `DefaultTaskEvaluator`:

- `frozen-choice:*` → `MEANING_CHOICE` / `CHOICE` for `ENTITY_REF`, `RELATION_CHOICE`, `SEMANTIC_CLASS`, `CLAIM_CHOICE`
- `frozen-text-input:*` → `ACTIVE_RECALL_TYPING` / `TEXT_INPUT` for `LEXICAL_FORM`

Not registered (do not fake them):

- `ORDERED_ENTITY_REFS`
- a context snapshot field on the task
- `CONTEXT_USE` as a skill
- Level 0–4 support as evidence semantics

## Capability gaps

- Frozen tasks have one `lexemeId` and only `CHOICE` / `TEXT_INPUT`.
- `hintCount` can mark `ASSISTED_CORRECT`, but cannot distinguish a Level 1 cue from a Level 4 answer reveal.
- `ORDER` / sequence steps return `COMPILATION_UNSUPPORTED_RESPONSE_KIND` / `EXP_NO_RUNTIME_CAPABILITY`.
- Prompt text flattens context; the task does not carry `ResolvedContextSnapshot`.

## How to run

```bash
npx vitest run tests/contextual-learning
npx tsc --noEmit
npm run lint
```

Validators live next to the types. Fixtures are deterministic data, not a planner.

## When Candidate V1 may be discussed

Only after:

- the three skeletons still instantiate three frames without semantic duplication
- claim grounding and borrow/lend perspective tests stay green
- a representative subset still compiles through the frozen evaluator/evidence path
- remaining gaps are explicit, not hidden in renderers
- a separate contract-changing task approves any frozen-semantics change

Passing tests here does not make this module a Standard.
