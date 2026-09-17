# Game Renderer Protocol

A Game Renderer is a consumer of Core V1. It displays a `PublicLearningTask` and emits a student action intent. It does not own learning.

## Responsibilities

| Layer | Owns | Does not own |
| --- | --- | --- |
| Game Renderer | Presentation, input, timing for `responseTimeMs` | Grading, evidence, mastery, word selection |
| Game Session Controller | Plan → generate one task → assign → submit → next need | Learning semantics |
| `submitTaskAction` | Load `TaskAnswerKey`, evaluate, write evidence | UI |
| TaskEvaluator | Correctness | Display |
| Learning Core | `StudentLexemeModel` | Games |

Ranger Trial (单词闯关), Word Bubble (单词泡泡), Matching (连连看), and Snake (贪食蛇) are the four reference renderers. Later games should replace only rendering. They must keep the same submission path.

```text
                       ┌──────── Ranger Trial
LearningSessionPlan    │
      ↓                │
 LearningNeed          │
      ↓                │
 TaskGenerator         │
      ↓                │
PublicLearningTask ────┼──────── Word Bubble
                       ├──────── Matching
                       └──────── Snake
                                  ↓
                         semantic event only
                                  ↓
                            StudentAction
                                  ↓
                     Generic Game Session Controller
                                  ↓
                           submitTaskAction
                                  ↓
                           TaskEvaluator
                                  ↓
                         LearningEvidence
                                  ↓
                           Learning Core
```

## PublicLearningTask-only rule

Client-facing Ranger Trial, Word Bubble, Matching, and Snake components may receive `PublicLearningTask`.

They must never receive:

- `TaskAnswerKey`
- `correctOptionIds`
- `optionLexemeIds`
- `expectedAnswer`
- `semanticAcceptedTexts`
- `isCorrect`

Answer keys stay in `learning_tasks` (or the in-memory task repository) and are loaded only inside `submitTaskAction`.

Do not store AnswerKey in `localStorage`, `sessionStorage`, React state from an `answer_key` API, or IndexedDB.

V1 may store only `sessionId` in `sessionStorage` so refresh can resume the active assigned task. Matching may also hold renderer-local interaction state (`selectedTarget`, `selectedOptionId` before submit, hover, connector animation). That state is ephemeral: refresh may reset a partial pair selection. The current `PublicLearningTask` remains.

## StudentAction-only output

The renderer emits user intent:

```ts
{ kind: "CHOICE", optionId }
{ kind: "TEXT_INPUT", value }
```

The controller attaches `taskId`, `occurredAt` (server time), `responseTimeMs`, and `hintCount` (`0` in V1). Visual components do not invent `EvidenceOutcome`.

Interaction rendering follows `responseContract.kind` **and** the game's capability:

| Renderer | Route | Contracts | Interaction |
| --- | --- | --- | --- |
| Ranger Trial (单词闯关) | `/play/ranger-trial` | `CHOICE` + `TEXT_INPUT` | option tap or typed submit |
| Word Bubble (单词泡泡) | `/play/word-bubble` | `CHOICE` only (`MEANING_CHOICE`, `RELATION_CHOICE`, `CONFUSABLE_CHOICE`) | single tap |
| Matching (连连看) | `/play/matching` | `CHOICE` only (`MEANING_CHOICE`, `RELATION_CHOICE`, `CONFUSABLE_CHOICE`) | composite: left target, then right candidate |
| Snake (贪食蛇) | `/play/snake` | `CHOICE` only (`MEANING_CHOICE`, `RELATION_CHOICE`, `CONFUSABLE_CHOICE`) | real-time loop; option collision collapses to one CHOICE |

Same semantic pipeline. Matching does not invent pair task types or a `PAIR` action. Multiple UI gestures can map to one `StudentAction`. Snake game ticks are not `StudentAction`s. Only collision with an option object emits `{ kind: "CHOICE", optionId }`.

Matching V1 is left-first, then right. A candidate tap before the target shows “先点左边的词。” and emits nothing. Only after both gestures does the renderer emit `{ kind: "CHOICE", optionId }`. The left tap is visual interaction state, not grading data. `responseTimeMs` starts when the task is interactable and stops when the complete pair is submitted — not on the first left click.

`LearningTaskType` may change copy (“选出正确意思”) but not correctness.

## GameCapability

`RANGER_TRIAL_CAPABILITY`, `WORD_BUBBLE_CAPABILITY`, `MATCHING_CAPABILITY`, and `SNAKE_CAPABILITY` answer: can this renderer **display** this task?

They do not answer what the student should practice (Scheduler) or whether the answer is correct (TaskEvaluator).

`canGameRenderTask(capability, task)` checks skill, prompt mode, answer mode, difficulty, and that the response contract is `CHOICE` or `TEXT_INPUT`. Word Bubble and Matching additionally require `responseContract.kind === "CHOICE"` via `canWordBubbleRenderTask` / `canMatchingRenderTask`. Unsupported tasks fail with `GAME_CANNOT_RENDER_TASK`.

Game compatibility filtering happens **after** the Scheduler returns an ordered `LearningNeed` list. The Scheduler stays game-agnostic. Filtered needs keep their original relative order. Exclusions are traced as `GAME_CAPABILITY_UNSUPPORTED`. If the plan is non-empty but nothing is playable, the controller returns `NO_PLAYABLE_NEEDS`.

## Game Session Controller

`LearningGameSessionController` is the single orchestration path. Ranger Trial, Word Bubble, Matching, and Snake are `LearningGameDefinition` + renderer adapters.

1. `planLearningSession()` once at session start (no per-task reschedule)
2. Filter planned needs against the game's supported skills
3. Take the next playable `LearningNeed`
4. `TaskGenerator.generate()` **one** task
5. `saveGeneratedTask` with `userId` + `sessionId`
6. Return `PublicLearningTask` only
7. On submit, call existing `submitTaskAction()` with the definition's `gameId`
8. Map `EvidenceOutcome` to `GameSubmissionFeedback` (presentation only)
9. On continue, generate the next planned need

`UNAVAILABLE` generation skips that need with a bounded loop and records `needId` / `lexemeId` / skill / code for developers. The renderer must not convert the task into another learning type.

Session stats (`attempted`, `correct`, `incorrect`) are UI counts. They are not `StudentLexemeModel`.

## Durable runtime (Phase 05.1)

Student-facing game actions compose a durable runtime. A cold start or a different serverless instance must be able to resume the same session.

```text
browser
  → Server Action (thin Ranger Trial, Word Bubble, Matching, or Snake wrapper)
  → LearningGameSessionController
  → durable game_sessions (orchestration, `game_type` + revision CAS)
  → durable learning_tasks (assignment + AnswerKey)
  → durable learning_evidence / student_lexeme_models
  → same submitTaskAction / TaskEvaluator / Learning Core
```

`sessionId` may live in `sessionStorage` so refresh can call `resumeRangerTrialSession`, `resumeWordBubbleSession`, `resumeMatchingSession`, or `resumeSnakeSession`. The browser must not store the LearningNeed plan, AnswerKey, StudentLexemeModel, Evidence, bubble layout, Matching partial selection, or Snake body/direction/ticks.

Responsibilities:

| Store | Holds | Does not hold |
| --- | --- | --- |
| `game_sessions.state` | plan needs, navigation, phase, presentation stats, last safe feedback | AnswerKey, Evidence, StudentLexemeModel, vocabulary copies |
| `learning_tasks` | generated task + AnswerKey + assignment | session progress |
| `learning_evidence` | immutable grading facts | UI counters |
| `student_lexeme_models` | Learning Core snapshot | game orchestration |

Refresh does **not** re-run the Scheduler. The original planned needs are persisted and resumed.

If Evidence write succeeds and session save fails, a retry maps `TASK_ALREADY_COMPLETED` / duplicate evidence into a one-time recovery onto `awaiting_continue`. Stats increment once per task via `lastCompletedTaskId`.

Randomization is recreated from `scheduler:${gameType}:${sessionId}` and `task:${gameType}:${sessionId}:${needId}`. Word Bubble layout uses `bubble-layout:${taskId}` and is not persisted. Matching keeps public option order and does not persist card selection. Snake rebuilds a deterministic board from `task.id` + `option.id`. The RandomSource object is not persisted.

Production uses Supabase adapters for learner/task/session state. Bundled vocabulary JSON is immutable reference data. `RANGER_TRIAL_RUNTIME=memory` is the legacy name of a shared local/e2e fixture for all four student games; `GAME_RUNTIME=memory` is a backward-compatible alias. Production must not set either flag and must not silently fall back to in-memory Maps. Student-game persistence/network work uses a shared server timeout (`createTimedFetch` / `withPersistenceTimeout`) and maps stalls to `NETWORK_ERROR` (“暂时没能准备好这一轮，请稍后再试。”). Play clients add a secondary loading timeout so “正在安排这一轮单词…” cannot remain forever if the Server Action itself stalls. A client timeout does not cancel server work; retrying start may create another session if the first request later completes.

If session persistence fails after `learning_tasks` insert, that assigned task may be orphaned. Do not delete it. Recovery starts a new session or regenerates from the persisted need; it does not treat `game_sessions` as learning truth.

## Optimistic concurrency (Phase 05.2)

`game_sessions.revision` is a monotonically increasing CAS token. New sessions insert at revision `0`. Updates use `WHERE id = ? AND revision = N` and write `N+1`. A stale write is `SESSION_CONFLICT` — never last-write-wins.

Continue and resume **claim** orchestration state (CAS persist) before generating the next task. Two concurrent continue/resume requests must not create competing `currentTaskId`s. The loser reloads at most once; if the winner already published a current task, that same task is returned. If the winner is still generating (`awaiting_action` and `currentTaskId` is null), the loser returns a retryable `SESSION_CONFLICT`.

If continue wins the CAS claim (`phase → awaiting_action`, `currentTaskId = null`) and then generation fails before the second save, resume may generate from that claimed state. That is acceptable.

`revision` is not exposed on the public session DTO.

Word Bubble does not persist bubble coordinates, velocity, or animation frames. Matching does not persist `selectedTarget` or a pre-submit `selectedOptionId`. Snake does not persist body, direction, tick, or option coordinates. Refresh may rebuild the visual layout or reset the snake to its initial cell. Learning/session progress remains intact.

Snake `responseTimeMs` includes navigation overhead (movement time until option collision). It is not directly comparable with Ranger Trial tap time. Core V1 still stores the field as-is. See ADR-063 and `GAME_INTERACTION_LATENCY_CONFOUND`.

## Feedback DTO

After evaluation, the browser receives:

```ts
{
  status: "CORRECT" | "ASSISTED" | "INCORRECT" | "SKIPPED" | "TIMEOUT";
  message: string;
  continueAvailable: boolean;
  correction?: { text: string };
}
```

`INDEPENDENT_CORRECT` → `CORRECT`. `ASSISTED_CORRECT` → `ASSISTED`. Correction text is computed server-side **after** evaluation. It is not the AnswerKey.

## Why games never grade

If a renderer had its own spelling tolerance or mastery shortcut, another renderer would teach a different language. Core V1 stays replaceable only if every game is a thin view over the same `PublicLearningTask` → `StudentAction` → `submitTaskAction` pipeline. Ranger Trial, Word Bubble, Matching, and Snake already share that path. One renderer interaction may contain 0, 1, 2, or many visual gestures or hundreds of game ticks; semantic submission remains one `StudentAction` → one `TaskEvaluation` → one terminal `LearningEvidence`.

## Auth (future work)

V1 has no login. Student pages use `V1_PLACEHOLDER_USER_ID`. The production form must not accept an arbitrary `userId` field.
