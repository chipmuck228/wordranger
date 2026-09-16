# Learning Core

Policy version: **v1**. All numeric thresholds live in `DEFAULT_LEARNING_POLICY` (`src/domain/learning/policies/default-learning-policy.ts`). This document matches that file.

## MasteryStage

How deeply the student has learned the lexeme. Forgetting is **not** a stage.

| Stage | Meaning |
| --- | --- |
| `UNSEEN` | No valid interaction yet |
| `EXPOSED` | At least one non-skipped interaction |
| `RECOGNIZED` | Independent recognition across sessions |
| `CONNECTED` | Meaning plus semantic relation |
| `RECALLED` | Independent production (typing/spelling) |
| `USABLE` | Independent use in more than one context |
| `MASTERED` | Multiple skills, tasks, and calendar days |

`FADING` and `WEAK` are not mastery stages.

## RetentionState

Memory stability, independent of stage.

| State | Meaning |
| --- | --- |
| `NEW` | Not yet enough stable evidence |
| `STABLE` | Independent successes have landed |
| `FADING` | Forgetting signal (overdue failure, high-stage failure, or score drop) |
| `RECOVERING` | First independent success after fading |

## Skills

V1 has exactly six skills:

- `MEANING_RECOGNITION`
- `LISTENING_RECOGNITION`
- `SEMANTIC_CONNECTION`
- `ACTIVE_RECALL`
- `SPELLING_RECALL`
- `CONTEXT_USE`

## Weakness

A weakness is a specific hole, not a stage. Identity for an open weakness:

- `CONFUSION` + `relatedLexemeId`
- otherwise `type` + `skill`

Retriggers update `severity`, `lastTriggeredAt`, and `reason.evidenceIds`. Historical rows are never deleted; recovery sets `resolvedAt`.

## Evidence

`LearningEvidence` is the only learning fact. Outcomes:

| Outcome | Target score |
| --- | --- |
| `INDEPENDENT_CORRECT` | 1.00 |
| `ASSISTED_CORRECT` | 0.55 |
| `INCORRECT` | 0.00 |
| `TIMEOUT` | 0.00 |
| `SKIPPED` | 0.50, with a smaller EWMA alpha |

`INDEPENDENT_CORRECT` means no hint/scaffold. `ASSISTED_CORRECT` means the student finished correctly after hint/scaffold. `hintCount > 0` cannot be recorded as independent success; `hintCount === 0` cannot be recorded as assisted success. Skip is not treated as a full error and does not expose an `UNSEEN` lexeme.

## Stage transitions

Evaluated by `evaluateStageTransition`. One promotion or V1 demotion per evidence item.

### Promotion

- **UNSEEN → EXPOSED**: first non-`SKIPPED` interaction, even if incorrect
- **EXPOSED → RECOGNIZED**: ≥2 independent recognition successes and ≥2 sessions. Meaning *or* listening is enough; both are not required
- **RECOGNIZED → CONNECTED**: meaning score ≥ 0.70, semantic score ≥ 0.55, ≥2 sessions
- **CONNECTED → RECALLED**: production skill (`ACTIVE_RECALL` or `SPELLING_RECALL`) with `TYPING`/`SPELLING`, score ≥ 0.65, ≥2 independent successes, ≥2 sessions. Multiple-choice cannot prove recall
- **RECALLED → USABLE**: `CONTEXT_USE` score ≥ 0.65, ≥2 `metadata.contextId` or `metadata.taskVariantId` values, ≥1 independent success
- **USABLE → MASTERED**: meaning ≥ 0.80, production ≥ 0.75, context ≥ 0.70, ≥3 practice days, ≥3 task types, ≥5 independent successes, ≥7 days since first seen, no unresolved weakness with severity above 0.60

Same-day grinding cannot satisfy the calendar-day / elapsed-time gates.

### Demotion (conservative)

V1 only allows:

- `MASTERED → USABLE`
- `USABLE → RECALLED`

A single error never drops `MASTERED` to `RECALLED`. Demotion needs recent failures across sessions (`demotionMinFailures` and `demotionMinFailureSessions`). A mastered spelling miss should become `FADING` + `SPELLING` weakness instead.

## Score algorithm

Target:

```text
target = clamp01(outcomeTarget * modeFactor * difficultyFactor)
modeFactor = answerModeNeutralFloor + (1 - floor) * answerModeWeight
difficultyFactor = 1 + (difficulty - 0.5) * difficultyInfluence
```

Answer-mode weights: MC/Matching 0.70, drag/tap 0.75, typing/spelling 1.00. Difficulty influence is 0.10, so it nudges the target instead of dominating it.

EWMA:

```text
newScore = oldScore * (1 - alpha) + target * alpha
alpha = 0.25 (0.08 for SKIPPED)
```

Scores are always clamped to `[0, 1]`.

Mastery score is a policy-weighted blend of the six skill scores.

## Confidence algorithm

Confidence is evidence quantity/diversity, not ability.

Skill confidence mixes capped ratios of attempts, independent successes, distinct sessions, and distinct calendar days. A single success is around 0.2, never 1.0.

Mastery confidence also includes distinct task types and total evidence count.

## Weakness policy

- Repeated error: last 3 of a skill, ≥2 incorrect/timeout
- Hint dependency: last 5, ≥3 `ASSISTED_CORRECT`
- Confusion: same wrong `selectedLexemeId` reaches threshold
- Spelling: current `SPELLING_MINOR` / `SPELLING_MAJOR`, or repeated spelling errors
- Slow response: slower than personal median × 1.8, or fallback 8000ms if the baseline is too small
- Long-term instability: ≥4 success/failure alternations in the last 6 countable outcomes

Recovery: consecutive independent successes decay severity; at/under 0.15 the weakness is resolved.

## Review scheduling

Base interval by stage: EXPOSED 1, RECOGNIZED 2, CONNECTED 3, RECALLED 4, USABLE 7, MASTERED 14 days. `FADING` multiplies by 0.35. `RECOVERING` multiplies by 0.50.

## Retention V1

- `NEW` until 2 independent successes, then `STABLE`
- `STABLE` → `FADING` on high-stage failure (USABLE+), overdue review failure, or skill score drop ≥ 0.20
- `FADING` + independent success → `RECOVERING` (not immediately `STABLE`)
- `RECOVERING` + later independent success in a **different session** → `STABLE`
