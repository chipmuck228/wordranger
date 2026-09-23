# Free Practice Contract Candidate V0

> Status: **Candidate / Not a Standard**
>
> This document investigates and designs a product contract. It does not
> implement a route, controller, or UI. It does not change frozen Core,
> Scheduler, TaskEvaluator, Evidence, or `StudentLexemeModel` semantics.
>
> Related: [ADR-084](./DECISIONS.md#adr-084--free-practice-is-a-separate-product-surface-candidate)

Revision after `17ebb05`: `RECENTLY_INCORRECT` is a latest-terminal-per-skill
read model, not “last 40 INCORRECT rows”. TaskGenerator input is a local
compatibility projection, not Scheduler provenance. Implementation is
conditional on that isolation being testable.

Do not treat the prompting task as authority. The inventory below is
taken from the current repository.

---

## 1. Why this Candidate exists

Daily Training (`/train`) can legally shrink from 8 items to 1.

Diagnosis already confirmed:

- `requestedNeedCount` is an upper bound, not a guarantee.
- Scheduler may return one `LearningNeed` when only one remains.
- An empty learner with the full unseen vocabulary still gets 8 needs
  for several consecutive rounds.
- Task-generation failure is not the primary shrink cause.
- Production visitors currently share `V1_PLACEHOLDER_USER_ID`.
- Current `/train` is Scheduler-driven Daily Training. It is **not**
  Free Practice, even though the Homepage label is 自由练习.

The missing product is a user-initiated practice path that can request
a fixed count from an explicit word pool **without** pretending those
words are current Scheduler `LearningNeed`s.

This Candidate defines that path. It is not a Standard and is not
wired into Homepage or `/train` by this document.

---

## 2. Work Contract compliance

Read and obeyed:

- `docs/CURSOR_WORKING_CONTRACT.md`
- `docs/CORE_V1_BASELINE.md`
- `docs/ARCHITECTURE.md`
- `docs/LEARNING_TASK_PROTOCOL.md`
- `docs/LEARNING_CORE.md`
- `docs/LEARNING_SCHEDULER.md`
- `docs/GAME_RENDERER_PROTOCOL.md`
- `docs/DAILY_TRAINING_EXPERIENCE.md`
- `docs/DATABASE.md`
- `docs/CONTEXTUAL_LEARNING_ARCHITECTURE_CANDIDATE.md`
- `docs/CONTEXTUAL_MEMORY_ROUTING_CANDIDATE_V0.md`
- `docs/CONTEXTUAL_STRENGTHEN_EXPERIENCE_CANDIDATE_V0.md`

This Candidate does **not**:

- unfreeze Core V1
- change Scheduler policy, quotas, or `LearningNeed` reasons
- add Evidence outcomes or a second learner model
- modify Context Lab
- change Homepage or `/train` behavior

If a later implementation conflicts with a frozen rule, stop and record
`CORE_INTEGRATION_BLOCKER` or a new ADR. Do not silently widen Core.

---

## 3. Phase 0 — Inventory from the repository

### 3.1 Current student surfaces

| Surface | Route | What it actually is | Student copy today |
| --- | --- | --- | --- |
| Daily Training | `/train` | Scheduler-driven product orchestration | Homepage 自由练习 |
| Free Play | `/play/ranger-trial`, `/play/word-bubble`, `/play/matching`, `/play/snake` | Game sessions that still call `planLearningSession()` | Not a Homepage entry |
| Ranger Trial UI pilot | `/play/ranger-trial` | Presentation-only shell over Scheduler Free Play | 单词闯关 |
| Context Lab | `/play/context-lab` | Candidate Probe → READY / STRENGTHEN / BUILD | Homepage: 场景学习正在准备中 |
| This Candidate | not implemented | User-initiated practice with an independent word pool | none |

ADR-082 uses “Free Practice” for the Ranger Trial UI pilot. That is
**not** this Candidate. ADR-083 uses student-facing 自由练习 for Daily
Training. That is also **not** this Candidate.

Internal English names in this document:

- **Daily Training** — `/train`
- **Free Play** — existing `/play/*` games
- **Free Practice** — this Candidate
- **Context Learning** — Context Lab Candidate layer

Do not collapse those four into one “开始练习” state machine.

### 3.2 Daily Training pipeline (current)

```text
Home 自由练习
  → /train
  → DailyTrainingController.start()
  → planLearningSession({ requestedNeedCount: DAILY_TRAINING_TASK_COUNT })
  → persist LearningNeed[] on game_sessions.game_type = DAILY_TRAINING
  → DefaultTaskGenerator.generate({ need })
  → PublicLearningTask
  → DIRECT_PRACTICE presentation
  → StudentActionIntent (CHOICE | TEXT_INPUT)
  → submitTaskAction
  → DefaultTaskEvaluator
  → EvidenceFactory
  → LearningEvidence (gameId = stored renderer, new items RANGER_TRIAL)
  → processEvidence
  → StudentLexemeModel
```

Authoritative files:

- `src/server/training/daily-training-controller.ts`
- `src/server/scheduler/plan-learning-session.ts`
- `src/domain/learning/learning-need.ts`
- `src/domain/tasks/public-learning-task.ts`
- `src/domain/tasks/student-action.ts`
- `src/domain/tasks/default-task-evaluator.ts`
- `src/domain/tasks/evidence-factory.ts`
- `src/domain/learning/evidence.types.ts`
- `src/domain/learning/student-lexeme-model.ts`
- `src/components/training/DirectPracticeRenderer.tsx`
- `src/server/game-session/learning-game-session-controller.ts`
- `src/server/auth/v1-user.ts`

### 3.3 `requestedNeedCount` is an upper bound

`DAILY_TRAINING_TASK_COUNT = 8` (`src/server/auth/v1-user.ts`).

`DeterministicScheduler.planSession()` uses
`requestedNeedCount ?? policy.session.defaultNeedCount`. Policy v2
defaults: `defaultNeedCount: 10`, `maxNewWords: 3`, `minReviewNeeds: 4`.

The planner may return fewer than requested when usable needs run out.
Daily Training accepts any non-empty plan. `NO_LEARNING_NEEDS` is thrown
only when `plan.needs.length === 0`.

Public UI `session.total` is `record.needs.length`. Completion
`stats.attempted` can be lower if generation skips a planned need.

### 3.4 `LearningNeed` is Scheduler / Need-Generator language

```ts
type LearningNeedReason =
  | "NEW_WORD"
  | "WEAKNESS"
  | "REVIEW_DUE"
  | "STAGE_PROGRESS"
  | "FADING"
  | "USER_MARKED";
```

A need is “why this lexeme/skill should be practiced **now**”. It is
not a task. Free Practice must not mint fake current pedagogical needs
and must not call `planLearningSession()` to impersonate Daily Training.

### 3.5 Task generation currently requires `LearningNeed`

`TaskGenerationRequest.need` is a `LearningNeed`.
`PublicLearningTask.learningNeedId` is required.
`MEANING_CHOICE` accepts every existing reason.
`LearningEvidence` has **no** `learningNeedId` field.

This is a frozen-protocol compatibility gap, not permission to extend
`LearningNeedReason` or to call the mapped object a current
`LearningNeed`. See §5.5. If a later implementation cannot keep that
projection isolated, it is a `CORE_INTEGRATION_BLOCKER`.

### 3.6 Evidence has no orchestration source field

`LearningEvidence` has `userId`, `lexemeId`, `taskId`, `sessionId`,
`gameId`, `taskType`, skill/prompt/outcome fields, and optional
`metadata`. Current factory metadata is only `{ evaluationTaskId }`.

`gameId` is the renderer (`RANGER_TRIAL`, `WORD_BUBBLE`, `MATCHING`,
`SNAKE`). ADR-070 forbids writing `DAILY_TRAINING` onto Evidence.

**Capability gap:** Evidence cannot name Daily Training vs Free Practice
by itself. V0 distinguishes them by `sessionId` →
`game_sessions.game_type`. Do not add a frozen Evidence field. Do not
encode the source in `taskId` text.

### 3.7 User-marked lexemes are not persisted

`UserMarkedLexeme` exists (`lexemeId`, `markedAt`, optional
`preferredSkill`). Need Generator can emit `USER_MARKED`.

Production Daily Training does **not** pass `userMarkedLexemes`.
Scheduler docs: “No persistence in V1.” Debug Lab keeps marks in
process memory. There is no student mark store.

### 3.8 Recently incorrect is not a current read model

`LearningStateQueryRepository.getRecentLearningActivity()` returns
`{ lexemeId, skill, taskType, occurredAt }` with **no outcome**.

`LearningRepository` can read evidence only per `userId + lexemeId`.

RECENTLY_INCORRECT therefore needs a new **read** query over a bounded
window of recent **terminal** Evidence (all outcomes). It does not
need a new Evidence type or field. Querying only `INCORRECT` rows is
forbidden: a later same-key correct result would stay invisible.

### 3.9 Identity

```ts
V1_PLACEHOLDER_USER_ID = "00000000-0000-4000-8000-000000000001"
```

No student login. Server actions must not accept `userId` from the
browser. RLS is not solved. All Vercel visitors currently share one
learner snapshot and Evidence log.

### 3.10 Session resume and idempotency

Daily Training and Free Play already provide the orchestration pattern
Free Practice must copy:

- Plan once; persist the plan copy on `game_sessions.state`.
- Generate one assigned task at a time.
- `revision` CAS; stale write is `SESSION_CONFLICT`.
- One task → one terminal Evidence.
- Duplicate submit → `TASK_ALREADY_COMPLETED` /
  `DUPLICATE_TASK_EVIDENCE`.
- Browser may store `sessionId` in `sessionStorage`. It must not store
  AnswerKey, plan, model, or Evidence.
- Start retry after a client timeout may still create a second session.
  Do not silently redesign that here.

### 3.11 Direct presentation already exists

`DIRECT_PRACTICE` is presentation identity, not Evidence `gameId`.
`DirectPracticeRenderer` reuses `RangerTrialTask` →
`ChoiceTaskRenderer` / `TextInputTaskRenderer` / `TaskPromptView`.
Daily Training hardcodes `hintCount: 0`. Student UI does not emit
`SKIP` or `TIMEOUT`. Inline feedback stays on the page; the student
taps 下一题.

### 3.12 Context Learning is a different Candidate

Context Lab Probe maps frozen observations to `READY` / `STRENGTHEN` /
`BUILD` / `UNRESOLVED`. STRENGTHEN and BUILD are experience intents,
not `LearningNeed` reasons. Homepage does not link Context Lab. This
task does not modify that layer.

---

## 4. Phase 1 — Three product concepts

These are different products. They may share frozen Task / Evaluator /
Evidence / Core. They may not share one session controller or one
“开始练习” state machine.

### 4.1 Daily Training

- User starts “today’s scheduled practice”.
- Server calls `planLearningSession()`.
- Only current `LearningNeed`s are practiced.
- `requestedNeedCount` is an upper bound.
- Fewer than 8 items is legal.
- Must not repeat just-completed healthy words to fill the count.
- Must not relax `maxNewWords` or v2 healthy-stage deferral to pad.
- Student-facing `/train` copy may stay 自由练习 until a later
  Homepage split. Internally it is Daily Training.

### 4.2 Free Practice

- User asks to practice now.
- The product does **not** claim “the Scheduler chose these words”.
- Selection uses an explicit `FreePracticeSource`.
- The user may request a fixed count (5 or 10).
- The server may return fewer if the eligible pool is smaller.
- Tasks still go through `PublicLearningTask` → `StudentAction` →
  `submitTaskAction` → `DefaultTaskEvaluator` → `EvidenceFactory` →
  `processEvidence`.
- Completion is “this group finished”, not “you learned these words”.

### 4.3 Context Learning

- Scene-scoped Probe, then READY / STRENGTHEN / BUILD.
- Strengthening a weak memory and building a missing memory are
  different experiences.
- Not a word-list drill.
- Not this Candidate.
- Do not route Free Practice into Context Lab, or Context Lab into
  Free Practice.

### 4.4 Forbidden conflation

Do not:

- reuse `DailyTrainingController` with a different count
- start Free Practice by calling `planLearningSession()` and relabeling
  the plan
- put Free Practice items into `game_sessions.game_type = DAILY_TRAINING`
- drive Context Lab from Free Practice completion
- let Homepage keep one CTA that silently switches products

Homepage is unchanged by this document. Slice 6, if approved later,
must introduce a second entry or a completion-only handoff. It must
not overwrite `/train`.

---

## 5. Phase 2 — V0 selection sources

Evaluated, not all selected.

### 5.1 Evaluation

| Source | Data today | Identity | Sort | Dedup | Short pool | Fill from others? | Daily Training conflict | Needs Scheduler? | V0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `UNSEEN` | `listLexemes()` minus models with `masteryStage !== UNSEEN` (missing model counts as unseen) | Yes | `sourceIndex`, then `canonicalKey` | `lexemeId` | `PARTIAL` or `EMPTY` | No | Writes real Evidence, so later Daily Training sees fewer `NEW_WORD`s. Expected. | No | **Yes — primary** |
| `RECENTLY_INCORRECT` | Bounded recent **terminal** Evidence window; latest row per `lexemeId + skill` must be `INCORRECT` | Yes | Selected-key `occurredAt` desc, then `lexemeId` | `lexemeId` (keep newest unresolved skill) | `PARTIAL` or `EMPTY` | No | May overlap current Daily needs. Allowed. | No | **Yes — named request** |
| `USER_MARKED` | In-memory Debug only; no store | Would | `markedAt` desc | `lexemeId` | `EMPTY` | No | N/A | No | **No — no persistence** |
| `RECENTLY_LEARNED` | Models with recent `lastSuccessAt` | Yes | `lastSuccessAt` desc | `lexemeId` | `PARTIAL` | No | Overlaps healthy words Daily Training just deferred | No | No |
| `MIXED` | Union of the above | Yes | Priority table | `lexemeId` | Auto-fill hides emptiness | Yes | Blurs Daily vs Free | Tempting, dishonest | No |

UNSEEN means unobserved, not “the student does not know the word”
(ADR-072). Free Practice UNSEEN is a practice request, not a claim of
ignorance and not a placement exam.

### 5.2 Selected V0 sources

V0 implements exactly two named request kinds:

1. `UNSEEN` — default. This is the product that Daily Training cannot
   honestly provide after Scheduler needs shrink.
2. `RECENTLY_INCORRECT` — explicit review of recent mistakes.

V0 does **not** implement `USER_MARKED`, `RECENTLY_LEARNED`, or `MIXED`.
V0 does **not** auto-fill one source from another.

`USER_MARKED` stays deferred until a server-authoritative mark store
exists. Inventing client-side stars would create a parallel weak-word
list, which Core V1 forbids.

### 5.3 Application types — not Scheduler output

```ts
type FreePracticeSource = "UNSEEN" | "RECENTLY_INCORRECT";

type FreePracticeRequestedCount = 5 | 10;

interface FreePracticeRequest {
  source: FreePracticeSource;
  requestedCount: FreePracticeRequestedCount;
}

interface FreePracticeItem {
  id: string;
  lexemeId: string;
  targetSkill: VocabularySkill;
  source: FreePracticeSource;
}

type FreePracticePlanResult =
  | {
      status: "READY";
      source: FreePracticeSource;
      requestedCount: number;
      plannedCount: number;
      items: FreePracticeItem[];
    }
  | {
      status: "PARTIAL";
      source: FreePracticeSource;
      requestedCount: number;
      plannedCount: number;
      items: FreePracticeItem[];
      reason: "INSUFFICIENT_ELIGIBLE_WORDS";
    }
  | {
      status: "EMPTY";
      source: FreePracticeSource;
      requestedCount: number;
      plannedCount: 0;
      items: [];
      reason: "NO_ELIGIBLE_WORDS";
    };
```

`userId` is **not** on the client request. The server binds the
authoritative user.

`FreePracticeItem` is not a `LearningNeed`. Do not put
`LearningNeedReason` on it.

### 5.4 Eligible-pool rules

**UNSEEN**

- Read bundled `listLexemes()` and `listStudentLexemeModels(userId)`.
- Eligible if no model exists, or `masteryStage === UNSEEN`.
- Exclude lexemes that cannot support `MEANING_RECOGNITION`
  (no usable `meaningsZh`).
- `targetSkill` is always `MEANING_RECOGNITION`.
- Sort by `sourceIndex` ascending, then `canonicalKey`.
- `sourceIndex` is list order, not difficulty.

**RECENTLY_INCORRECT**

This is an application read model over existing `LearningEvidence`.
It does not add Evidence fields, does not read `Weakness[]` as
authority, and does not call the Scheduler.

Do not query “the last 40 `INCORRECT` rows”. That keeps a later-corrected
error eligible forever and contradicts completion/repeat `EMPTY`.

#### Algorithm

Application constant, not a Scheduler or Core constant:

```ts
FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT = 40
```

1. **Window.** Load the user's 40 most recent **terminal** Evidence
   rows, **all outcomes**. Order: `occurredAt` descending, then `id`
   descending. If the user has fewer than 40, use all of them.
   Evidence outside this window is invisible. A very old `INCORRECT`
   must not re-enter merely because it is still among the last 40
   incorrect rows.

2. **Latest per key.** Group window rows by `lexemeId + skill`.
   For each key, the latest row is the first in that same order
   (`occurredAt` desc, `id` desc).

3. **Unresolved recent incorrect.** A key is eligible only when that
   latest outcome is `INCORRECT`.
   - `INDEPENDENT_CORRECT` or `ASSISTED_CORRECT` on the **same**
     `lexemeId + skill` **clears** the key.
   - `SKIPPED` and `TIMEOUT` are not `INCORRECT`, so they neither
     keep nor create eligibility.
   - A success on a **different** skill does **not** clear the key.
     Default: cross-skill success is not a resolution.

4. **Missing vocabulary.** Drop a key whose `lexemeId` is absent from
   the current bundled `listLexemes()`.

5. **Generatable skill.** V0 can generate
   `MEANING_RECOGNITION`, `ACTIVE_RECALL`, `SPELLING_RECALL`, and
   `SEMANTIC_CONNECTION` when required content exists. Drop a key
   whose skill is not generatable (`LISTENING_RECOGNITION`,
   `CONTEXT_USE`, or missing content). **Do not** rewrite that key
   into another skill. Silent fallback to `MEANING_RECOGNITION`
   would practice a different skill and then clear the wrong key.

6. **Dedup by `lexemeId`.** If one lexeme still has several unresolved
   generatable skills, keep **one** item: the key whose latest
   `INCORRECT` is newest (`occurredAt` desc, then `id` desc).
   `targetSkill` is that key's skill.

7. **Plan order.** Remaining items sort by that selected-key
   `occurredAt` descending, then `lexemeId` ascending.

8. **No weakness invention.** Do not require an unresolved `Weakness`.
   Do not emit `USER_MARKED` or `WEAKNESS` needs.

#### Worked acceptance

| Id | History in / affecting the window | Eligible? | Result |
| --- | --- | --- | --- |
| A | meaning `INCORRECT`, then meaning correct | No | meaning key cleared |
| B | meaning `INCORRECT`, then spelling correct | Yes | meaning key still latest `INCORRECT` |
| C | same lexeme, two unresolved skills | One item | newer `occurredAt` skill |
| D | three lexemes, each one unresolved `INCORRECT`; request 10 | Yes | `PARTIAL`, `plannedCount: 3` |
| E | those three later answered correctly on the **same** skill | No | `EMPTY` |
| F | `INCORRECT` older than the 40-row terminal window, even if it is still among the last 40 incorrect rows | No | outside window |

Assisted correct counts as a clearing success for this read model
only. It is not independent mastery.

Do not call the Scheduler for either pool.

### 5.5 TaskGenerator compatibility projection

`DefaultTaskGenerator.generate()` still requires `LearningNeed`.
Changing that interface is a Task Protocol change and is out of scope.

`FreePracticeItem` remains the application object. It is not a
`LearningNeed` and not Scheduler output.

V0 may build a **local compatibility projection** solely to call the
frozen generator:

```text
FreePracticeItem
  → toTaskGenerationProjection(item)
  → DefaultTaskGenerator.generate({ need: projection })
```

Projection rules:

- `NEW_WORD` and `STAGE_PROGRESS` are existing **archetype routing
  tokens** only. They are not a current pedagogical need, not a
  Scheduler reason, and not a mastery judgment.
- Mapping, if isolation holds:
  - `UNSEEN` → routing token `"NEW_WORD"`
  - `RECENTLY_INCORRECT` → routing token `"STAGE_PROGRESS"`
- `projection.id` equals `FreePracticeItem.id`.
- `lexemeId` / `targetSkill` copy the item.
- `priority` is `0`. No `weaknessFocus` in V0.
- `preferredPromptModes` and `avoidRecentTaskTypes` stay empty.
- The projection **must not** enter a `LearningSessionPlan`.
- `game_sessions.state` stores only `FreePracticeItem[]` and Free
  Practice session fields. It must not persist the projection or a
  scheduler plan.
- `PublicLearningTask.learningNeedId` is the frozen protocol's
  required correlation value. In this Candidate it equals
  `FreePracticeItem.id`. It is not Scheduler provenance.
- `LearningEvidence` does **not** store `learningNeedId`. Do not add
  that field.
- Student UI never sees `LearningNeed`, routing tokens, or the
  projection.
- Do not add `FREE_PRACTICE` to `LearningNeedReason`.

A later implementation **must** include architecture / boundary tests
showing that no production consumer treats the projection as Scheduler
provenance (no write to `LearningSessionPlan`, no Scheduler trace, no
Evidence / snapshot field, no student copy).

If those tests cannot prove isolation, stop and record
`CORE_INTEGRATION_BLOCKER`. Do **not** modify `LearningNeedReason`,
`TaskGenerator`, Evidence, or Scheduler to paper over the gap.

If a future Standard wants TaskGenerator to accept a thinner input,
that is a separate contract-changing task.

### 5.6 Daily Training interaction

Free Practice Evidence is real Evidence. After an UNSEEN probe:

- Core may move `UNSEEN` → `EXPOSED`.
- Scheduler v2 may defer healthy `STAGE_PROGRESS` until `nextReviewAt`.
- Later Daily Training may have fewer `NEW_WORD` slots.

That is correct. Daily Training must not pad, and Free Practice must
not write a shadow model to hide the effect.

An in-progress Daily Training session and a Free Practice session may
contain the same `lexemeId`. They remain different assignments
(`sessionId` + `taskId`). One task still produces one Evidence.

---

## 6. Phase 3 — Count contract

| Rule | V0 value |
| --- | --- |
| Allowed requested counts | `5`, `10` |
| Default request | `10` |
| Maximum | `10` |
| Minimum playable | `1` |
| May return fewer than requested | Yes |
| Auto-fill from another source | No |
| Promise a fixed 8 | No |

Result mapping:

- `plannedCount === requestedCount` → `READY`
- `0 < plannedCount < requestedCount` → `PARTIAL`
- `plannedCount === 0` → `EMPTY`

`PARTIAL` is success, not an error. The session plays the planned
items. UI may say 这次有 3 个可练习的单词.

`EMPTY` does not create a `game_sessions` row. UI:

- UNSEEN empty: 现在没有可练习的新单词
- RECENTLY_INCORRECT empty: 最近没有答错的单词
- Plus 回到首页
- No fake words

Repeated start after a completed or abandoned session creates a **new**
session from a **fresh** read-model plan. It does not replay the
previous plan.

For `RECENTLY_INCORRECT`, that fresh plan uses the algorithm in §5.4.
If every previously eligible `lexemeId + skill` now has a later
same-skill correct result, the next request is `EMPTY`. If those keys
are still latest-`INCORRECT`, they remain eligible. A different-skill
success does not remove them. This matches cases A, B, D, and E.

A client timeout on start may still create a second session. Same
inherited limitation as Daily Training. Do not hide it.

Progress display uses planned count, not requested count: `2 / 3`,
never `2 / 10` when only 3 were planned.

---

## 7. Phase 4 — Evidence semantics

| Question | V0 answer |
| --- | --- |
| Does Free Practice write `LearningEvidence`? | **Yes.** Same factory, same table. |
| Does a correct answer update `StudentLexemeModel`? | **Yes.** Through `processEvidence` only. |
| `hintCount`? | Same field. V0 student path sends `0`, like Daily Training. |
| Full answer reveal? | **Not in V0 UI.** A later reveal must increment `hintCount` and become `ASSISTED_CORRECT`. |
| Can assisted correct advance mastery? | It updates the snapshot. It is **not** `isIndependentSuccess`. Stage gates that require independent success do not count it. Score target stays `0.55`. |
| Skip / timeout? | Domain writes `SKIPPED` / `TIMEOUT` Evidence. V0 student UI does not offer those actions. |
| Repeat submit? | Existing idempotency. No second Evidence. |
| How to tell Free Practice from Daily Training? | `sessionId` → `game_sessions.game_type`. Not an Evidence field. |

Preferred path — reuse, do not fork:

```text
PublicLearningTask
  → StudentAction
  → submitTaskAction
  → DefaultTaskEvaluator
  → createLearningEvidenceFromTaskEvaluation
  → processEvidence
  → StudentLexemeModel
```

Forbidden:

- `FreePracticeEvidence`
- a second learner model
- client-set outcome
- changing independent / assisted / incorrect meaning
- writing `FREE_PRACTICE` into `Evidence.gameId`
- stuffing source into `taskId` or `metadata` as a hidden contract

`Evidence.gameId` for new Free Practice items is `RANGER_TRIAL`, the
same renderer Daily Training already records for direct items.
`DIRECT_PRACTICE` remains presentation identity only.

Orchestration identity:

```ts
FREE_PRACTICE_ORCHESTRATION_TYPE = "FREE_PRACTICE"
```

Store it on `game_sessions.game_type` only. Same pattern as
`DAILY_TRAINING`.

**Capability gap (recorded, not patched):** `LearningEvidence` has no
legal orchestration/source identifier. Analytics that need the source
must join sessions. Do not unfreeze Evidence to add one.

Skip is not a full error and does not expose an UNSEEN lexeme
(`docs/LEARNING_CORE.md`). Timeout is a failure. V0 UI avoiding both
keeps the first UNSEEN contact as a real probe.

---

## 8. Phase 5 — Identity prerequisite

### 8.1 Current fact

`V1_PLACEHOLDER_USER_ID` is acceptable only for **single-user internal
testing**.

On Vercel, every visitor shares that id. Evidence, snapshots, and
“no remaining Daily need” are therefore shared. Public Free Practice
on that id would let strangers consume one another’s unseen pool and
write into one another’s model.

### 8.2 Hard rules

- The browser must not submit `userId`.
- `localStorage` / `sessionStorage` UUIDs are not trusted server
  identity.
- Server actions bind `userId` from a server-authoritative session.
- Public Free Practice must not ship on the shared placeholder.

### 8.3 Options compared (not implemented here)

| | A. Supabase anonymous auth | B. Email / magic-link | C. Single-device internal identity | D. Keep placeholder |
| --- | --- | --- | --- | --- |
| Server `userId` | `auth.uid()` from Supabase session cookie | same, after email verify | server-issued httpOnly cookie / signed device token | hardcoded constant |
| RLS | `auth.uid()` policies become possible | same | still service-role only | still service-role only |
| Persistence | browser session + refresh token | same, plus email recovery | that browser / device only | process / deploy global |
| Multi-device | no | yes | no | accidentally yes, and harmful |
| Migration | map placeholder rows to the first real user, or leave them as fixtures | same | isolate test users; do not migrate public traffic onto placeholder | none |
| Public deploy | **minimum acceptable** | better later | internal only | **not acceptable** |

### 8.4 Recommendation

- **Public Free Practice:** A, then B when multi-device login is a
  product requirement.
- **Internal / CI isolation before A lands:** C, or test-only random
  UUIDs that never ship to Vercel student routes.
- **D:** forbidden for any publicly reachable Free Practice route.

Slice 1 must land before a public `/practice` (or equivalent) is
exposed. Local tests may use isolated ids. They must not default to
the placeholder on a shared durable database.

Do not implement auth, RLS, or identity in this documentation task.

---

## 9. Phase 6 — Daily Training completion UX (design only)

Today `TrainingComplete` always shows 再练一组 and 回首页. The client
cannot know whether another Scheduler round is honest. `session.total`
from the round just finished is not the remaining-need count.

### 9.1 Server projection

After Daily Training completion, the server returns one public,
non-sensitive next action. It must not include Scheduler trace,
blocked reasons, or raw need lists.

```ts
type TrainingCompletionNextAction =
  | { kind: "ANOTHER_DAILY_ROUND_AVAILABLE" }
  | { kind: "DAILY_LEARNING_COMPLETE" }
  | { kind: "FREE_PRACTICE_AVAILABLE" };
```

Computation (server only):

1. Call `planLearningSession({ requestedNeedCount: 8 })` as a
   **read-only preview**. Do not persist that plan.
2. Let `remainingNeeds = plan.needs.length`.
3. `DAILY_NEXT_ROUND_MIN_NEEDS = 4` (application UX threshold, not a
   Scheduler change).
4. If Free Practice is not publicly available (identity Slice 1 not
   landed, or feature closed):
   - `remainingNeeds >= 4` → `ANOTHER_DAILY_ROUND_AVAILABLE`
   - else → `DAILY_LEARNING_COMPLETE`
5. If Free Practice is publicly available:
   - `remainingNeeds >= 4` → `ANOTHER_DAILY_ROUND_AVAILABLE`
   - else if UNSEEN or RECENTLY_INCORRECT pool `>= 1` →
     `FREE_PRACTICE_AVAILABLE`
   - else → `DAILY_LEARNING_COMPLETE`

Threshold `4` is half of `DAILY_TRAINING_TASK_COUNT`. It exists so a
legal 1-need Scheduler result does not keep offering 再练一组. It is
not a Core or Scheduler constant. Do not implement it by padding the
next Daily plan.

### 9.2 Student copy (Candidate, not shipped)

| Next action | Primary button | Secondary | Status text |
| --- | --- | --- | --- |
| `ANOTHER_DAILY_ROUND_AVAILABLE` | 再练一组 | 回首页 | none extra |
| `DAILY_LEARNING_COMPLETE` | 回首页 | — | 今天适合练习的内容已经完成 |
| `FREE_PRACTICE_AVAILABLE` | 再练一些单词 | 回首页 | 今天适合练习的内容已经完成 |

“再练一些单词” is the Candidate student name for Free Practice. It
avoids stealing Homepage 自由练习 before Slice 6. Do not say
“Scheduler”, “LearningNeed”, or “掌握”.

`FREE_PRACTICE_AVAILABLE` is used only when Daily Training should stop
offering another scheduled round. It may still show 今天适合练习的内容已经完成.

This section is not implemented here. `/train` behavior stays as it is.

---

## 10. Phase 7 — Direct presentation

Free Practice V0 uses the same direct presentation as Daily Training.
It does not use Word Bubble, Matching, Snake, or the 单词闯关 chrome.

Reuse:

- `ChoiceTaskRenderer`
- `TextInputTaskRenderer`
- `TaskPromptView`
- `TaskFeedback` / `InlineTrainingFeedback`
- `DirectPracticeRenderer`

Do not copy those components into a second tree.

| Concern | V0 rule |
| --- | --- |
| CHOICE | Render `responseContract.kind === "CHOICE"`. Clicking an option sends `{ kind: "CHOICE", optionId }`. |
| TEXT_INPUT | Render the text field. Submit sends `{ kind: "TEXT_INPUT", value }`. |
| Progress | `current / plannedCount`. Planned, not requested. |
| Feedback | Inline, once. 答对了 / 再看看. Student taps 下一题. No auto-advance. |
| Retry | Network/start errors: retry + back. Do not leave 正在准备… forever. |
| Resume | Restore the same `sessionId` + `currentTaskId` + `DIRECT_PRACTICE`. |
| Completion | 本组练习完成, attempted / correct. Next action from the Free Practice completion DTO, not from Daily Training next-action. |
| Keyboard | Native buttons and text fields. Focus rings already on choice buttons. |
| Reduced motion | No extra motion beyond current global `prefers-reduced-motion` CSS. Do not add auto-advance timers. |

Client sends intent only. Server attaches `taskId`, `occurredAt`,
`responseTimeMs`, and `hintCount: 0`. Client never grades, never
receives `TaskAnswerKey`, never chooses `userId`, never chooses the
correct option id except by tapping a visible choice.

Suggested later route: `/practice`. Not `/train`. Not `/play/*`.

---

## 11. Phase 8 — Invariants

1. Free Practice does not call Scheduler to impersonate Daily Training.
2. Free Practice does not write `StudentLexemeModel` except through
   `processEvidence`.
3. Free Practice does not copy `DefaultTaskEvaluator`.
4. Free Practice does not create a second Evidence type or table.
5. Free Practice does not connect to Context Lab.
6. Free Practice does not let the client choose `userId`.
7. Free Practice does not let the client choose the correct answer
   except as an ordinary visible choice tap / typed submit.
8. Free Practice does not guarantee mastery.
9. Free Practice does not call one completed group “学会了”.
10. Daily Training does not break spacing or v2 deferral to fill a
    count.
11. Free Practice does not treat a TaskGenerator compatibility
    projection as a `LearningNeed` or Scheduler output.
12. Free Practice does not write `FREE_PRACTICE` onto `Evidence.gameId`.
13. Free Practice does not keep a client-side weak-word list.
14. `sourceIndex` is not difficulty.
15. UNSEEN is unobserved, not unknown.
16. Student UI does not expose Scheduler, LearningNeed, mastery,
    retention, or weakness enums.

---

## 12. Phase 9 — Three-case validation

Assumptions: server-authoritative identity is present; vocabulary still
has usable meaning content; no auto-fill.

### Case 1 — 100 unseen, request 10

- **Request:** `{ source: "UNSEEN", requestedCount: 10 }`
- **Eligible pool:** 100 unseen lexemes, ordered by `sourceIndex`
- **Plan:** `READY`, `plannedCount: 10`, first 10 in source order
- **Tasks:** compatibility projection routing token `NEW_WORD`, skill
  `MEANING_RECOGNITION`, lazy `DefaultTaskGenerator`, assign to this
  session. Projection is not persisted.
- **Evidence:** one row per completed task; `gameId = RANGER_TRIAL`;
  `sessionId` is the Free Practice session
- **Completion:** 本组练习完成 / 完成 10 个 / 答对 N 个
- **Next action:** another Free Practice start is allowed; Daily
  Training is unchanged until the user opens `/train`
- **UI:** 开始练习 → `1 / 10` … `10 / 10`. No Scheduler claim.

### Case 2 — 3 unresolved recent incorrect, request 10

- **Request:** `{ source: "RECENTLY_INCORRECT", requestedCount: 10 }`
- **Eligible pool:** 3 distinct lexemes whose latest same-skill
  terminal Evidence in the 40-row window is `INCORRECT`
- **Plan:** `PARTIAL`, `plannedCount: 3`,
  `reason: "INSUFFICIENT_ELIGIBLE_WORDS"`
- **Tasks:** three tasks; compatibility projection routing token
  `STAGE_PROGRESS`; `targetSkill` from the selected unresolved key
- **Evidence:** at most three new rows; no padding Evidence
- **Completion:** 完成 3 个
- **Repeat:** rebuild the read model. Same-skill correct on all three
  → `EMPTY`. Same-skill still `INCORRECT` → `PARTIAL` 3 again.
- **UI:** 这次有 3 个可练习的单词. Never show `1 / 10`.

If the user had requested `UNSEEN` instead, this pool would be
irrelevant. V0 does not mix.

#### Case 2 acceptance rows

These are required Slice 2 tests, not optional examples.

**A.** meaning `INCORRECT`, then meaning correct → that lexeme is not
eligible.

**B.** meaning `INCORRECT`, then spelling correct → meaning error
remains eligible; `targetSkill` stays `MEANING_RECOGNITION`.

**C.** one lexeme, meaning and spelling both latest-`INCORRECT` → one
item; `targetSkill` is the skill with newer `occurredAt` (tie-break
`id`).

**D.** three unresolved incorrect lexemes, request 10 → `PARTIAL`,
`plannedCount: 3`.

**E.** those three later answered correctly on the same skill →
`EMPTY`, `plannedCount: 0`. No session row.

**F.** an `INCORRECT` outside the last 40 terminal Evidence rows is
not eligible, even if it would still appear in “last 40 INCORRECT
rows”.

### Case 3 — Placeholder / exhausted Daily needs, user still wants practice

Shared placeholder after many successful Daily rounds: Scheduler
preview returns 0–3 needs (legal). Bundled unseen remains large.

- **Daily completion projection:** if identity Slice 1 has not landed
  for public traffic, next action is `DAILY_LEARNING_COMPLETE` only.
  Do **not** offer public Free Practice on the shared placeholder.
- **After identity exists:** Daily next action is
  `FREE_PRACTICE_AVAILABLE` when unseen or recently incorrect `>= 1`.
- **Free Practice request:** `{ source: "UNSEEN", requestedCount: 10 }`
- **Eligible pool:** remaining unseen for **that** user
- **Plan:** `READY` or `PARTIAL` from that pool, never from Scheduler
  leftovers
- **Tasks / Evidence:** same frozen pipeline
- **Completion:** ordinary group complete. Copy must not say
  今天适合练习的内容已经完成 on the Free Practice page; that sentence
  belongs to Daily Training completion
- **UI:** 再练一些单词. Not 再练一组, which stays Daily Training.

If this case is executed on `V1_PLACEHOLDER_USER_ID` in production,
the contract is violated even if the planner is correct.

---

## 13. Phase 10 — Implementation slices

Do not implement these slices in this task.

### Slice 1 — Identity boundary

Implementation note: a server-only port now exists at
`src/server/free-practice/identity`. It is not a Standard, not a
`/practice` route, and does not change `/train`. Anonymous sessions
are not created here; later slices must establish them through
official Supabase Auth cookies.

- **Does:** server-authoritative `userId` for student actions; refuse
  client `userId`; keep placeholder off public Free Practice.
- **Files expected:** `src/server/free-practice/identity/*`,
  `docs/DATABASE.md` identity notes, tests under `tests/free-practice/`.
- **Frozen forbidden:** `src/domain/learning/**`,
  `src/domain/scheduler/**`, evaluator, EvidenceFactory.
- **Tests:** actions ignore/reject injected `userId`; public route
  closed without auth; placeholder not used when identity is present.
- **Rollback:** feature flag off; student routes keep current
  placeholder Daily Training.
- **Done:** public Free Practice cannot run as the shared placeholder.

### Slice 2 — Free Practice plan / read model

- **Does:** `FreePracticeRequest` → eligible pool →
  `FreePracticePlanResult`. UNSEEN first; `RECENTLY_INCORRECT` uses
  the latest-terminal-per-skill algorithm in §5.4.
- **Files expected:** `src/server/free-practice/plan-free-practice.ts`,
  types, query port that returns a bounded terminal Evidence window
  (all outcomes), not Core.
- **Frozen forbidden:** Scheduler policy, Need Generator, Evidence
  schema, `LearningNeedReason`.
- **Tests:** 100 unseen → 10 `READY`; Case 2 A–F; 0 eligible →
  `EMPTY`; no `planLearningSession` call; UNSEEN order is
  `sourceIndex` then `canonicalKey`; query is not “last N INCORRECT
  rows”.
- **Rollback:** delete the module; no sessions exist yet.
- **Done:** planner is pure application code and does not persist.

### Slice 3 — Server-authoritative session

- **Does:** `FreePracticeController` on `game_sessions.game_type =
  FREE_PRACTICE`; CAS; lazy task generation; resume.
- **Files expected:** `src/server/free-practice/*`, session state
  schema documented in `docs/DATABASE.md`.
- **Frozen forbidden:** Core engine, Scheduler, evaluator.
- **Tests:** start / submit / continue / resume / duplicate submit /
  double continue / `SESSION_CONFLICT`; persisted state contains
  `FreePracticeItem[]` only — no `LearningSessionPlan`, no projection
  `reason`.
- **Rollback:** unused `game_type` rows are inert; no table drop
  required.
- **Done:** one plan per session; public payloads have no AnswerKey.

### Slice 4 — Direct renderer

- **Does:** `/practice` (or approved name) reusing
  `DirectPracticeRenderer` and inline feedback.
- **Files expected:** `src/app/practice/**`, thin client, reuse
  `src/components/training/*`.
- **Frozen forbidden:** games must not grade; no new renderer tree.
- **Tests:** architecture import boundary; payload safety; e2e start →
  answer → 下一题 → complete; no consumer treats
  `PublicLearningTask.learningNeedId` as Scheduler provenance.
- **Rollback:** unpublish the route.
- **Done:** no Bubble / Matching / Snake / 单词闯关 chrome.

### Slice 5 — Evidence integration

- **Does:** `submitTaskAction` with `gameId = RANGER_TRIAL`;
  `hintCount: 0`; existing idempotency.
- **Files expected:** controller submit path only.
- **Frozen forbidden:** Evidence types, factory, `processEvidence`,
  policy numbers.
- **Tests:** one Evidence per task; assisted/independent unchanged;
  session join can recover `FREE_PRACTICE`; Evidence has no
  `learningNeedId`; no production consumer reads the projection as
  Scheduler provenance.
- **Rollback:** stop creating sessions; existing Evidence remains
  valid facts.
- **Done:** no `FreePracticeEvidence`; no `gameId = FREE_PRACTICE`.

### Slice 6 — Homepage integration

- **Does:** decide student labels. Keep `/train` as Daily Training.
  Add a distinct Free Practice entry or keep Free Practice
  completion-only.
- **Files expected:** `src/components/home/*`,
  `src/server/home/resolve-home-learning-paths.ts`,
  `docs/DAILY_TRAINING_EXPERIENCE.md`.
- **Frozen forbidden:** learning semantics.
- **Tests:** two CTAs do not share one state machine; Homepage still
  does not link Context Lab.
- **Rollback:** hide the new entry; `/train` CTA unchanged.
- **Done:** no silent swap of `/train` into Free Practice.

This document does not change Homepage.

### Slice 7 — Daily Training completion next action

- **Does:** server preview plan + optional Free Practice pool check;
  public `TrainingCompletionNextAction`.
- **Files expected:** Daily Training complete DTO, `TrainingComplete`,
  `docs/DAILY_TRAINING_EXPERIENCE.md`.
- **Frozen forbidden:** Scheduler weights/quotas; no padding.
- **Tests:** remaining 8 → 再练一组; remaining 1 → no 再练一组;
  no trace in the client payload.
- **Rollback:** restore always-on 再练一组.
- **Done:** client does not infer next action from `session.total`.

---

## 14. Naming and documentation impact

Current student 自由练习 means Daily Training. This Candidate’s
internal name is Free Practice. Suggested student name for the new
surface is 再练一些单词 until Slice 6 deliberately splits Homepage.

Existing “Free Practice” in ADR-082 / Ranger Trial UI pilot remains
Free Play presentation. Do not reuse that phrase in student UI.

Allowed later doc updates, when a slice lands:

- `docs/ARCHITECTURE.md` — add the third student path without merging
  it into the Daily Training diagram
- `docs/DAILY_TRAINING_EXPERIENCE.md` — completion next actions
- `docs/DATABASE.md` — `game_type = FREE_PRACTICE`
- `docs/DECISIONS.md` — promote ADR-084 only if this Candidate becomes
  a Standard

This task adds the Candidate ADR only. It does not rewrite frozen
Core docs.

---

## 15. Frozen-boundary confirmation

This Candidate forbids edits to:

- `src/domain/learning/engine/**`
- `src/domain/learning/evidence.types.ts`
- `src/domain/learning/learning-need.ts`
- `src/domain/learning/student-lexeme-model.ts`
- `src/domain/learning/policies/**`
- `src/domain/scheduler/**`
- `src/domain/tasks/default-task-evaluator.ts`
- `src/domain/tasks/evidence-factory.ts`
- `src/domain/tasks/task-archetype-registry.ts`

Allowed later, in implementation slices, not now:

- new `src/server/free-practice/**`
- `game_sessions.game_type` value `FREE_PRACTICE`
- a read query for a bounded recent **terminal** Evidence window
- identity / auth adapters
- `/practice` UI that reuses existing renderers
- architecture tests that the compatibility projection is not
  Scheduler provenance; otherwise `CORE_INTEGRATION_BLOCKER`

---

## 16. Final Candidate statement

Free Practice V0 can be implemented **only after** the TaskGenerator
compatibility-projection boundary in §5.5 is proven by tests. Until
then, this Candidate defines the contract; it does not claim the
isolation is already demonstrated.

If that isolation cannot be proven, the honest result is
`CORE_INTEGRATION_BLOCKER`. Do not change `LearningNeedReason`,
TaskGenerator, Evidence, or Scheduler to bypass it.

The path still needs its own request, latest-terminal-per-skill
`RECENTLY_INCORRECT` read model, session `game_type`, and identity
boundary. It reuses Task / Evaluator / Evidence / Core.

It is not Daily Training with a larger count. It is not Context Lab.
It is not the Ranger Trial UI pilot. It is not a Standard until a
later contract-changing task accepts it.
