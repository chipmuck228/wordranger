# Contextual Learning Domain — Candidate V0

**Status: Candidate / Experimental / Not a Standard.**

This module is an adapter spike. It is not a project standard, is not wired into production Daily Training or Free Play, and is not part of the stable public API.

## Where it sits

```text
LearningNeed  →  LearningExperiencePlan / ExperienceStepSpec
                 → compileExperienceStep
                 → frozen PublicLearningTask
                 → frozen StudentAction / TaskEvaluator / LearningEvidence
```

The candidate layer may choose a skeleton, frame, semantic steps, support blocks, and required runtime capabilities.

It does **not** decide correctness, invent evidence, or update `StudentLexemeModel`.

## Transport compatibility is not Evidence compatibility

Two questions are now separate:

| Question | Registry | Passes when |
| --- | --- | --- |
| Can the frozen runtime carry this answer form? | `ResponseTransportCapability` | `CHOICE` or `TEXT_INPUT` can host the response kind |
| Can frozen Evidence honestly record this cognition? | `FrozenSemanticProjection` whitelist | Candidate action, response kind, target focus, and step purpose are exactly equivalent to one frozen task/skill |

Compilation requires **all** of:

```text
transport exists
AND semantic projection exists
AND sense → lexeme projection is unambiguous
AND the answer spec is explicit
```

`findFrozenCapability(action, responseKind)` is transport-only. It is not a compile decision.

A generic Choice adapter is forbidden. `CHOICE` transport for `CLAIM_CHOICE` / `RELATION_CHOICE` / `SEMANTIC_CLASS` / situational `ENTITY_REF` does **not** produce `MEANING_RECOGNITION` Evidence.

## Current semantic projection whitelist

| Candidate action | Response | Target focus | Purpose | Frozen task | Frozen skill | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `TYPE` or `RECALL` | `LEXICAL_FORM` | `MEANING_TO_FORM` | `RECALL` | `ACTIVE_RECALL_TYPING` | `ACTIVE_RECALL` | Allowed |

No other combination is compiled.

## Why some authored steps do not compile

These fixtures remain valid **domain representations**. They fail compilation because frozen Evidence cannot describe the cognition:

| Candidate response | Typical fixture | Error | Why Evidence would be wrong |
| --- | --- | --- | --- |
| `CLAIM_CHOICE` | School try/success | `COMPILATION_SEMANTIC_MISMATCH` | Judging whether a claim/goal holds is not meaning recognition |
| Contextual `RELATION_CHOICE` | Borrow/lend direction | `COMPILATION_SEMANTIC_MISMATCH` | Event perspective is not frozen `SEMANTIC_CONNECTION` or `MEANING_RECOGNITION` |
| `SEMANTIC_CLASS` | Classification | `COMPILATION_SEMANTIC_MISMATCH` | Class membership is not lemma-to-meaning recognition |
| Situational `ENTITY_REF` | Meal “which tool for soup?” | `COMPILATION_SEMANTIC_MISMATCH` | Function/context reasoning is not `FORM_TO_MEANING` |
| `ORDERED_ENTITY_REFS` | Borrow state order | `COMPILATION_UNSUPPORTED_RESPONSE_KIND` | No frozen sequence contract |

Domain representation succeeding is not the same as frozen runtime being able to host its Evidence.

## Sense-level Candidate vs lexeme-level Evidence

Candidate identity is `lexemeId + senseId`. Frozen Evidence stores only `lexemeId`.

`sameLexemeSense` is the only legal identity check. Surface form, `displayForm`, or a lone `senseId` is not identity.

If one frozen lexeme appears with more than one answer-changing sense in the same compilation scope, compilation returns `COMPILATION_AMBIGUOUS_SENSE_PROJECTION`. Frozen Evidence is not extended with `senseId`.

## Explicit answers

Choice responses declare `candidates` and `correctCandidateIds`. The compiler copies those IDs onto `TaskAnswerKey`. It does not infer answers from string inclusion, ID naming, or `predicate.expected`.

## Fixtures

| Case | Skeleton | What it proves |
| --- | --- | --- |
| Meal | `meal-setting-v0` | One skeleton, three frames. `SUITABLE_FOR` is a contextual fact, not a universal lexical truth. Meal RECALL can compile; IDENTIFY cannot. |
| School Challenge | `goal-directed-challenge-v0` | Abstract words bind as property / action / state / outcome / grounded claim. Local success is not general ability. CLAIM_CHOICE does not compile. |
| Borrowing-Sharing | `temporary-resource-access-v0` | Same transfer event; requester perspective is `borrow`, owner perspective is `lend`. Contextual RELATION_CHOICE does not compile. |

Each case has three `ContextFrame`s plus BUILD and STRENGTHEN plans.

## Runtime transports actually registered

- `frozen-choice-transport` → can carry `ENTITY_REF`, `RELATION_CHOICE`, `SEMANTIC_CLASS`, `CLAIM_CHOICE`
- `frozen-text-input-transport` → can carry `LEXICAL_FORM`

Not registered (do not fake them):

- `ORDERED_ENTITY_REFS`
- a context snapshot field on the task
- `CONTEXT_USE` as a skill
- Level 0–4 support as evidence semantics

## Capability gaps

- Frozen tasks have one `lexemeId` and only `CHOICE` / `TEXT_INPUT`.
- `hintCount` can mark `ASSISTED_CORRECT`, but cannot distinguish a Level 1 cue from a Level 4 answer reveal.
- Prompt text flattens context; the task does not carry `ResolvedContextSnapshot`.
- Most Candidate choice cognitions have transport but no honest Evidence projection.

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

Passing tests here does not make this module a Standard, production-ready, or a full experience runtime.
