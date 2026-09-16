# Learning Scheduler

Phase 04 answers: **what should this student practice next?**

It does not generate tasks, grade answers, or mutate learning state. Those remain Task Generator, TaskEvaluator, and Learning Core.

```text
Vocabulary Domain
        │
        ↓
StudentLexemeModel
        │
        ↓
Learning Need Generator
        │
        ↓
LearningNeedCandidate[]
        │
        ↓
Candidate scoring / capability filter / dedupe
        │
        ↓
Deterministic Scheduler
        │
        ↓
LearningSessionPlan
        │
        ↓
Selected LearningNeed
        │
        ↓
Existing Task Generator
```

## LearningNeedCandidate

A candidate is an internal, pre-schedule need:

- why this lexeme/skill should be practiced
- which rule produced it
- a human-readable explanation
- optional weakness focus and metadata (severity, invalid lexeme, fallback)

Candidates are not the downstream contract. `LearningNeed` is.

## Need Generator

`DefaultLearningNeedGenerator` is pure. The application layer loads vocabulary, student models, recent activity, and user marks, then passes plain data in.

V1 rules:

| Reason | When |
| --- | --- |
| `NEW_WORD` | No model, or `masteryStage === UNSEEN`. Target skill is always `MEANING_RECOGNITION`. Ordered by `sourceIndex`, then `canonicalKey`. |
| `WEAKNESS` | Every unresolved weakness, mapped through `weakness-skill-map.ts`. `CONFUSION.relatedLexemeId` is preserved. |
| `REVIEW_DUE` | `nextReviewAt !== null` and `nextReviewAt <= now`. Target skill from `selectReviewSkill()`. Future dates do not create this reason. `MASTERED` due items remain eligible. |
| `STAGE_PROGRESS` | Evidence still missing for the next stage, via `selectStageProgressSkill()`. `MASTERED` has no normal stage-progress candidate. |
| `FADING` | `retentionState === FADING`. Recovers existing knowledge: unresolved weakness skill, else weakest practiced skill, else stage-appropriate skill. |
| `USER_MARKED` | Injected `UserMarkedLexeme[]`. High priority. No persistence in V1. |

`RECOVERING` is not a need reason. Recovering models use `REVIEW_DUE` / `STAGE_PROGRESS` / `WEAKNESS` as appropriate.

The generator does not call `new Date()` or `Math.random()`. Callers inject `now` and `createId`.

## Capability filtering

`LearningContentCapability` is static in V1:

- supported: `MEANING_RECOGNITION`, `SEMANTIC_CONNECTION`, `ACTIVE_RECALL`, `SPELLING_RECALL`
- blocked: `LISTENING_RECOGNITION`, `CONTEXT_USE`

The generator may still emit a pedagogical need for an unsupported skill. The scheduler then marks it `BLOCKED` with `UNSUPPORTED_CONTENT_CAPABILITY`.

That blocked row stays in `SchedulerTrace`. For `STAGE_PROGRESS` / `REVIEW_DUE` on `CONTEXT_USE`, a semantically reasonable production fallback may also be generated. Context **weaknesses** are not rewritten into meaning review. If no valid fallback exists, the candidate stays blocked.

## Priority scoring

Every scored candidate has a `PriorityBreakdown`. There are no unexplained totals.

```text
priority =
  reasonBase
  + weaknessBoost
  + overdueBoost
  + fadingBoost
  + skillGapBoost
  + confidenceAdjustment
  - recencyPenalty
```

All numeric weights live in `DEFAULT_SCHEDULER_POLICY` (`version: v1`). Semantic reason order is intended to emerge from `reasonWeights`:

`WEAKNESS > FADING > USER_MARKED > REVIEW_DUE > STAGE_PROGRESS > NEW_WORD`

Overdue boost grows with days late and caps at `overdue.maxBoost`. Low skill score and low confidence increase priority. Recent same-lexeme activity applies a penalty; repeated same-skill activity applies a smaller one. Penalties never hard-block.

Final priority is clamped to `[0, 1]`.

## Deduplication

Key: `lexemeId + targetSkill`.

Example: quiet + `SPELLING_RECALL` from `WEAKNESS`, `FADING`, and `REVIEW_DUE` becomes one `LearningNeed`.

- primary reason uses explanation precedence (same order as above)
- `supportingReasons` holds the other unique reasons
- highest-severity unresolved weakness becomes `weaknessFocus`
- `preferredPromptModes` is the deduplicated union
- `avoidRecentTaskTypes` is filled from recent activity for that lexeme

Numeric priority still comes from merged score components (max of boosts, winner skill-gap / recency).

## Quotas

From policy, not hardcoded `10`:

- `session.defaultNeedCount`
- `session.maxNewWords`
- `session.minReviewNeeds`

Review for quota purposes means primary reason `WEAKNESS`, `FADING`, or `REVIEW_DUE`.

If enough review candidates exist, the plan includes at least `minReviewNeeds` of them, and at most `maxNewWords` `NEW_WORD`-primary needs.

If fewer review/progress candidates exist than requested slots, remaining slots may be filled with `NEW_WORD`, even above `maxNewWords`. Thousands of unseen lexemes must not dominate a session when review work exists.

## Diversity

`maxSameSkillInRow` and `maxSameReasonInRow` defer a candidate when a different one can still fill the next slot. Deferred candidates can appear later in the same plan.

If only urgent / homogeneous candidates remain, the constraint is relaxed and the trace records `diversity constraint relaxed`. The planner prefers a full plan over an undersized one.

## LearningSessionPlan

Ephemeral. No `scheduler_sessions` table.

```ts
{
  id,              // injected createId()
  userId,
  createdAt,       // injected now
  schedulerPolicyVersion,
  requestedNeedCount,
  needs: LearningNeed[],
  trace: SchedulerTrace
}
```

The scheduler never calls `DefaultTaskGenerator`. A debug lab may take a selected need and pass it unchanged to the existing generator.

## SchedulerTrace

JSON-serializable. Distinguishes:

- generated
- blocked (`UNSUPPORTED_CONTENT_CAPABILITY`, `INVALID_LEXEME`, `MISSING_MODEL_DATA`, `NO_USABLE_TARGET_SKILL`)
- deduplicated (`mergedInto`)
- selected
- deferred

Plus quota and diversity decisions. Each candidate trace includes lexeme, skill, reason, source rule, explanation, and priority breakdown when scored.

## Determinism

Same models, vocabulary, recent activity, policy, `now`, and seed produce the same plan.

Injected:

- `now`
- `RandomSource` (tie-break only after score, and after stable `NEW_WORD` sourceIndex/canonicalKey order)
- `createId`

The domain does not call `Math.random()`, `new Date()`, or `crypto.randomUUID()`.

## Why the scheduler is read-only

Only Learning Core may change `MasteryStage`, `RetentionState`, weaknesses, or `StudentLexemeModel`. The scheduler must not create fake evidence. Scheduling is a projection: given current snapshots, what needs exist, and which of those belong in this session.

`LearningStateQueryRepository` is a separate read port. `LearningRepository` stays the mutation port used by `processEvidence`.
