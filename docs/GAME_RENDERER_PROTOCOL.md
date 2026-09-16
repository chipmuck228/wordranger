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

Ranger Trial (单词闯关) is the first reference renderer. Later games (Snake, Bubble, Matching, Detective, Boss) should replace only rendering. They must keep the same submission path.

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
StudentAction intent
        ↓
Game Session Controller
        ↓
submitTaskAction
        ↓
TaskEvaluator  +  server-side TaskAnswerKey
        ↓
LearningEvidence
        ↓
Learning Core
        ↓
StudentLexemeModel
```

## PublicLearningTask-only rule

Client-facing Ranger Trial components may receive `PublicLearningTask`.

They must never receive:

- `TaskAnswerKey`
- `correctOptionIds`
- `optionLexemeIds`
- `expectedAnswer`
- `semanticAcceptedTexts`
- `isCorrect`

Answer keys stay in `learning_tasks` (or the in-memory task repository) and are loaded only inside `submitTaskAction`.

Do not store AnswerKey in `localStorage`, `sessionStorage`, React state from an `answer_key` API, or IndexedDB.

V1 may store only `sessionId` in `sessionStorage` so refresh can resume the active assigned task.

## StudentAction-only output

The renderer emits user intent:

```ts
{ kind: "CHOICE", optionId }
{ kind: "TEXT_INPUT", value }
```

The controller attaches `taskId`, `occurredAt` (server time), `responseTimeMs`, and `hintCount` (`0` in Ranger Trial V1). Visual components do not invent `EvidenceOutcome`.

Interaction rendering follows `responseContract.kind`:

- `CHOICE` → choice buttons
- `TEXT_INPUT` → text field + submit

`LearningTaskType` may change copy (“选出正确意思”) but not correctness.

## GameCapability

`RANGER_TRIAL_CAPABILITY` answers: can this renderer **display** this task?

It does not answer what the student should practice (Scheduler) or whether the answer is correct (TaskEvaluator).

`canGameRenderTask(capability, task)` checks skill, prompt mode, answer mode, difficulty, and that the response contract is `CHOICE` or `TEXT_INPUT`. Unsupported tasks fail with `GAME_CANNOT_RENDER_TASK`.

## Game Session Controller

`RangerTrialSessionController`:

1. `planLearningSession()` once at session start (no per-task reschedule)
2. Take the next `LearningNeed`
3. `TaskGenerator.generate()` **one** task
4. `saveGeneratedTask` with `userId` + `sessionId`
5. Return `PublicLearningTask` only
6. On submit, call existing `submitTaskAction()`
7. Map `EvidenceOutcome` to `GameSubmissionFeedback` (presentation only)
8. On continue, generate the next planned need

`UNAVAILABLE` generation skips that need with a bounded loop and records `needId` / `lexemeId` / skill / code for developers. The renderer must not convert the task into another learning type.

Session stats (`attempted`, `correct`, `incorrect`) are UI counts. They are not `StudentLexemeModel`.

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

If Ranger Trial had its own spelling tolerance or mastery shortcut, another renderer would teach a different language. Core V1 stays replaceable only if every game is a thin view over the same `PublicLearningTask` → `StudentAction` → `submitTaskAction` pipeline.

## Auth (future work)

V1 has no login. Student pages use `V1_PLACEHOLDER_USER_ID`. The production form must not accept an arbitrary `userId` field.
