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
Lexeme-aware content feasibility
        │
        ↓
Candidate scoring / dedupe
        │
        ↓
Quota classification using ALL merged reasons
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
| `NEW_WORD` | No model, or `masteryStage === UNSEEN`. Target skill is always `MEANING_RECOGNITION`. Ordered by `sourceIndex` (source-list order, **not** difficulty), then `canonicalKey`. |
| `WEAKNESS` | Every unresolved weakness, mapped through `weakness-skill-map.ts`. `CONFUSION.relatedLexemeId` is preserved. |
| `REVIEW_DUE` | `nextReviewAt !== null` and `nextReviewAt <= now`. Target skill from `selectReviewSkill()`. Future dates do not create this reason. `MASTERED` due items remain eligible. |
| `STAGE_PROGRESS` | Evidence still missing for the next stage, via `selectStageProgressSkill()`. `MASTERED` has no normal stage-progress candidate. |
| `FADING` | `retentionState === FADING`. Recovers existing knowledge: unresolved weakness skill, else weakest practiced skill, else stage-appropriate skill. |
| `USER_MARKED` | Injected `UserMarkedLexeme[]`. High priority. No persistence in V1. |

`RECOVERING` is not a need reason. Recovering models use `REVIEW_DUE` / `STAGE_PROGRESS` / `WEAKNESS` as appropriate.

The generator does not call `new Date()` or `Math.random()`. Callers inject `now` and `createId`.

## Capability filtering

Skill-global support is not enough. `SEMANTIC_CONNECTION` can be feasible for one lexeme and blocked for another.

`LearningContentCapability` is **lexeme/content-aware**:

- `MEANING_RECOGNITION` — at least one non-blank `meaningsZh`
- `ACTIVE_RECALL` / `SPELLING_RECALL` — usable meaning **and** usable lemma/display
- `SEMANTIC_CONNECTION` — at least one **production-approved** relation from the bulk `VocabularyRepository.listRelations()` graph (same `VocabularyContentPolicy` as `getRelations()`; `rule_inferred` stays out of production)
- `LISTENING_RECOGNITION` / `CONTEXT_USE` — unsupported in V1 (not faked from IPA or generated text)

`planLearningSession` loads lexemes and production-approved relations once, builds these facts locally, and passes a capability object into the domain scheduler. The scheduler does **not** call Task Generator to probe feasibility. Feasibility means *enough approved content to attempt generation*, not that every random path will succeed.

The generator may still emit a pedagogical need for an unsupported skill. The scheduler then marks it `BLOCKED` with `UNSUPPORTED_CONTENT_CAPABILITY` and optional `capabilityReason`. That blocked row stays in `SchedulerTrace`.

For `STAGE_PROGRESS` / `REVIEW_DUE` on `CONTEXT_USE`, a production fallback may also be generated. Context **weaknesses** are not rewritten into meaning review.

For `FADING`, the preferred unsupported need stays blocked, and a separate supported recovery fallback may be added (`FADING_RECOVERY_FALLBACK`) if a meaningful practiced/supported skill exists. If none exists, only the blocked candidate remains.

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

All numeric weights live in `DEFAULT_SCHEDULER_POLICY` (current production version: `v2`; frozen `SCHEDULER_POLICY_V1` keeps prior admission semantics). Semantic reason order is intended to emerge from `reasonWeights`:

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

**Primary reason is explanation.** Quota classification uses **all merged sources** (`need.reason` plus `supportingReasons`):

- new-introduction: any source reason `NEW_WORD` (`isNewIntroductionNeed`)
- review: any of `WEAKNESS`, `FADING`, `REVIEW_DUE` (`isReviewNeed`)

So `USER_MARKED` + `NEW_WORD` still counts against `maxNewWords`, and `USER_MARKED` + `REVIEW_DUE` still counts toward `minReviewNeeds`. One need can belong to both categories.

Diversity still uses the primary reason, because that is the session's explanation pattern.

If enough review candidates exist, the plan includes at least `minReviewNeeds` of them, and at most `maxNewWords` new-introduction needs.

If fewer review/progress candidates exist than requested slots, remaining slots may be filled with new-introduction needs, even above `maxNewWords`. Thousands of unseen lexemes must not dominate a session when review work exists.

`sourceIndex` is PDF/source numbered order. It is not difficulty, CEFR, or grade. Do not treat a later index as a harder word.

## Progressive placement (scheduler v2)

UNSEEN means the system has no evidence yet. It does not mean the student does not know the word.

A first independent success on a probe still goes through TaskEvaluator → Evidence → Core (`UNSEEN` → `EXPOSED`). Scheduler v2 then **omits** healthy `STAGE_PROGRESS` for that same skill until `nextReviewAt`, so the word does not immediately occupy another identical `MEANING_RECOGNITION` slot. Incorrect, assisted, and weakness-tagged results stay eligible.

This is not mastery. One multiple-choice success does not set `MASTERED`. There is no hardcoded easy-word list.

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

Plus quota and diversity decisions. Each candidate trace includes lexeme, skill, reason, source rule, explanation, optional `capabilityReason`, and priority breakdown when scored.

## Determinism

Same models, vocabulary, recent activity, policy, `now`, and seed produce the same plan.

Injected:

- `now`
- `RandomSource` (tie-break only after score, and after stable `NEW_WORD` sourceIndex/canonicalKey order)
- `createId`

The domain does not call `Math.random()`, `new Date()`, or `crypto.randomUUID()`.

## Performance characteristics

Session planning remote vocabulary query count is constant with respect to lexeme count:

```text
Promise.all:
  vocabulary.listLexemes()
  vocabulary.listRelations()
  learning-state models
  recent activity
→ local O(L + R) capability map
→ Scheduler
```

- `L` = lexemes, `R` = production-approved relations
- no per-lexeme relation request during planning
- `listRelations()` is deterministically ordered by `type`, `fromLexemeId`, `toLexemeId`, `id`
- Task Generator still uses single-lexeme `getRelations(lexemeId)` at task-generation time

Do not replace this bulk read with `Promise.all` over N `getRelations()` calls. That is still N+1.

## Why the scheduler is read-only

Only Learning Core may change `MasteryStage`, `RetentionState`, weaknesses, or `StudentLexemeModel`. The scheduler must not create fake evidence. Scheduling is a projection: given current snapshots, what needs exist, and which of those belong in this session.

`LearningStateQueryRepository` is a separate read port. `LearningRepository` stays the mutation port used by `processEvidence`.
