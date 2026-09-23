# Contextual Learning Domain — Candidate V0

**Status: Candidate / Experimental / Not a Standard.**

This module is an adapter spike. It is not a project standard, is not wired into production Daily Training or Free Play, and is not part of the stable public API.

## Where it sits

```text
LearningNeed  →  LearningExperiencePlan / ExperienceStepSpec
                 → classify: ASSESSABLE_FROZEN_TASK | GUIDED_ACTIVITY | UNSUPPORTED
                 → compileExperienceStep (assessable only)
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
| Meal | `meal-setting-v0` | One skeleton, three frames. Scene Content authors Home Breakfast and Restaurant Meal natively. Picnic still uses compatibility projection. BUILD is guided present / observe / contrast then assessable RECALL. STRENGTHEN recall-weakness is guided reconnect / fade then frozen recall. STRENGTHEN IDENTIFY remains assessable and unsupported. `meal-scene-expansion-batch-01` and `meal-scene-expansion-batch-02` are Candidate V0 / fingerprint-bound / `APPROVED_FOR_EXPERIMENT` only for experimental Context Lab; not Standard and not production `/train`. See `docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_01_CANDIDATE.md` and `docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_02_CANDIDATE.md`. |
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

## Experience Execution Protocol Candidate V0

`execution/` is a domain-only sequencer. It is not a production runtime.

```text
validated LearningExperiencePlan
  → ExperienceRun(READY)
  → classify current step from explicit executionIntent
  → GUIDED_ACTIVITY_ISSUED + PublicGuidedActivity
     or FROZEN_TASK_ISSUED + PublicLearningTask
     or BLOCKED / UNSUPPORTED
  → acknowledge receipt or frozen-task receipt
  → next READY step, or COMPLETED
```

It manages plan order and issued-task identity only.

`createExperienceRun` deep-copies the plan plus the real `ResolvedContextSnapshot` and `ResolvedTargetSnapshot[]`. It rejects a plan whose terminal / `END` step would fire before every required step can complete, or whose resolved ids do not match the plan.

`issueCurrentStep` assembles `TaskCompilationRequest` from that snapshot only for assessable steps that have a semantic projection. Guided steps emit `PublicGuidedActivity` only after every `presentedEntityIds` / `presentedFactPredicates` value is an exact member of the frozen snapshot `entityBindings[].entityId` / `facts[].predicate`. Ungrounded Guided references block the run; they are never stripped, skipped, or downgraded. The caller cannot supply `resolvedContext`, `resolvedTargets`, `displayForm`, facts, or entity bindings at issue time.

A `PublicGuidedActivity` is bound to one `ExperienceRun`. Its id is `guided:${run.id}:${stepId}`. The public activity also carries `runId`. Completion matches the stored `ExperienceStepRun.activityId` exactly, so a receipt from run A cannot complete run B even when both runs share the same plan, `experienceId`, `stepId`, and context frame. The old `guided:${experienceId}:${stepId}` format is not accepted.

A valid completion receipt always persists `STEP_COMPLETED` on that step. The run never stays issued after the receipt has been recorded.

Assessable frozen tasks can produce frozen Evidence later, through the existing evaluator path. Guided activities do not produce Evidence. Guided completion means only that the host acknowledged the presentation; it is not learning success. Unsupported steps stay `BLOCKED`. A compile failure never becomes guided.

The Meal BUILD sequence is an execution-protocol demo: three acknowledgements, then one frozen recall. It does not prove the learner understood the scene. School `CLAIM_CHOICE` and Borrow `RELATION_CHOICE` remain assessable and unsupported.

It does **not**:

- grade
- call `DefaultTaskEvaluator` / `evidence-factory` / `processEvidence`
- update `StudentLexemeModel`
- interpret `INDEPENDENT_CORRECT` / scores / mastery
- skip an unsupported step
- downgrade a blocked step into `MEANING_CHOICE`

If an assessable step has no semantic projection (Meal STRENGTHEN IDENTIFY, School `CLAIM_CHOICE`, Borrow `RELATION_CHOICE`), the run becomes `BLOCKED` and does not emit a guided activity. The next step is never compiled or skipped.

Context Lab persistence is experimental orchestration only. The Meal BUILD pilot may assign a frozen task and call `submitTaskAction`. Candidate execution still does not grade, construct Evidence, or update `StudentLexemeModel`.

## Context Lab UI pilot

Internal experimental route:

```text
/play/context-lab
```

Gates:

```text
CONTEXT_LAB_ENABLED=1
CONTEXT_LAB_RUNTIME=memory
CONTEXT_LAB_RUNTIME=supabase
```

Default is closed. When the feature flag is absent, the route returns `notFound()` and server operations fail closed. Runtime selection does not bypass the gate. Do not set a `NEXT_PUBLIC_` copy of either flag. Do not reuse `GAME_RUNTIME` or `RANGER_TRIAL_RUNTIME`.

Current coverage is Meal BUILD on `home-breakfast-v0` only. School Challenge and Borrowing-Sharing are not wired.

## Content Release Pipeline Candidate V0

`release/` is a Candidate validation/publish domain. Phase 3 assembles a release from the unique `RELEASE_ELIGIBLE` Meal pack and a data-driven approval-source registry. Target count is not hardcoded. It is still Experimental, not Standard, and not wired to `/train`. See `docs/CONTEXTUAL_CONTENT_RELEASE_CANDIDATE_V0.md`.

The server is authoritative for the current step:

```text
server creates ExperienceRun
  → issues only the current step
  → client receives one public screen + opaque run handle
  → client acknowledges the current Guided Activity
  → server verifies ownership + revision + activityId
  → server records Guided completion
  → server issues the next current step
  → repository CAS-saves the updated run
  → client receives only the next public screen
```

The browser never receives the complete `ExperienceRun`, future steps, the plan snapshot, resolved targets, AnswerKey, Evidence, or learner state.

### Repository boundary

`ContextLabRunRepository` stores Candidate orchestration JSON only. It does not store Evidence, mastery, AnswerKey, or submitted preview text.

- `CONTEXT_LAB_RUNTIME=memory` is allowed for local development, unit/component tests, and Playwright. It must be selected explicitly.
- `CONTEXT_LAB_RUNTIME=supabase` is required when the experimental route is enabled on a deployed Vercel production/preview host. Missing Supabase service-role configuration fails closed. There is no silent memory fallback.
- Invalid or missing `CONTEXT_LAB_RUNTIME` is a controlled configuration error.

CAS: new runs persist at revision `0`. Each successful acknowledgement updates `WHERE revision = N` to `N+1`. Concurrent acknowledgements of the same `runId + revision + activityId` produce one advancement and one `CONTEXT_LAB_STALE_RUN`.

### Refresh and restart

The server page creates and persists the first run before render. Refresh before submission is a new request and therefore a new experimental run. This phase does not implement resume of an in-progress Guided or issued task.

After a frozen task has been submitted, retrying the same `taskId` reconciles to the existing `LearningEvidence`. Refresh still starts a new experimental run and will assign a new deterministic task if the learner walks the flow again.

`重新体验` calls the server restart/start operation, receives a new run ID, and begins at the first step of the current experimental plan. The previous run is abandoned and is not learning truth. Expiry/cleanup of abandoned experimental runs is a later gap. Meal Context Lab Probe now uses the five-word experiment pack (original four plus cup).

### Frozen task Evidence loop

After three legal Guided acknowledgements the server:

1. compiles the Meal recall step;
2. persists the complete generated task through `LearningTaskRepository.saveGeneratedTask` with a deterministic UUID (`runId + stepId`);
3. CAS-saves the Candidate run as `FROZEN_TASK_ISSUED`;
4. returns only `PublicLearningTask`.

The typing UI reuses Ranger Trial `TextInputTaskRenderer`. `Evidence.gameId` is therefore `RANGER_TRIAL`. Context Lab is orchestration identity, not a new frozen game ID.

The browser sends only `{ runId, revision, taskId, action: { kind: "TEXT_INPUT", value }, responseTimeMs }`. The server attaches user/session/game/evidence identity and calls existing `submitTaskAction`. Context Lab does not inspect AnswerKey, grade, construct Evidence, or call `processEvidence`.

Required order:

```text
validate issued run/task
→ submitTaskAction
→ Evidence committed
→ recordFrozenTaskCompletion
→ CAS-save COMPLETED Candidate run
→ public frozen feedback + “这次练习已记录。”
```

Incorrect Evidence still completes orchestration. Completion means the assessable task was terminally processed, not that the word is mastered.

If Evidence exists and Candidate CAS fails, retry loads the existing Evidence by `taskId + userId + sessionId` and completes the run without a second Evidence.

There is no `/train` integration.

Candidate V0 remains Experimental / Not a Standard.

Learner-facing rules:

- Guided `继续` means “I have viewed this presentation.” It is not correctness.
- Rapid `继续` clicks cannot skip a screen. The client waits for the server screen.
- Reduced motion (`prefers-reduced-motion: reduce`) replaces the screen immediately after the server responds.

Tested presentation viewports:

```text
375 × 812
768 × 1024
1440 × 900
```

Playwright binds the preview server to `127.0.0.1` and sets `CONTEXT_LAB_ENABLED=1`, `CONTEXT_LAB_RUNTIME=memory`, `CONTEXT_LAB_E2E=1`, and `CONTEXT_LAB_E2E_PROBE_ENABLED=1`. The memory probe stays 404 unless that dedicated probe flag is set on an explicit local/test host. Do not add the probe flags to ordinary development env files. Deployed hosts and `CONTEXT_LAB_RUNTIME=supabase` always 404 the probe.

Validators live next to the types.

## Experience Planner Candidate V0

`planning/` is a pure, deterministic selector over reviewed plan variants. It is not the Scheduler and not the Task Generator.

```text
opaque LearningNeed reference
  + externally supplied CognitiveMode
  + explicit target senses
  + allowed contexts
  + runtime capabilities
        ↓
planExperience
        ↓
LearningExperiencePlan + planning trace
        ↓
existing validation / execution / compiler
```

It does **not**:

- generate a `LearningNeed`
- inspect or update `StudentLexemeModel`
- infer `CognitiveMode` (no `UNSEEN → BUILD`)
- grade, create Evidence, or call `processEvidence`
- select a renderer
- use randomness, current time, or ID-string inference

Mode selection from learner state is out of scope.

## Contextual Memory Routing Candidate V0

`memory-routing/` is a pure frozen-need router plus a reviewed scene-vocabulary catalog. It is not a second learner model.

```text
Frozen LearningNeed projection + mapped LexemeSenseRef
  → routeContextualMemory
  → RESOLVED BUILD|STRENGTHEN or UNRESOLVED
  → planningModeFromRoutingDecision
  → existing planExperience({ mode, memoryRoutingDecision })
```

`NEW_WORD` / UNSEEN is **not** BUILD. Work Contract treats UNSEEN as unobserved. The router returns `MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL`.

`REVIEW_DUE` and focused `WEAKNESS` types route to STRENGTHEN. Missing, unknown, or conflicting signals stay UNRESOLVED and fail closed. The planner never re-reads a snapshot to pick an intent.

The scene catalog maps only current Meal / School / Borrow fixture words onto real bundled UUIDs. Coverage is `npm run contextual:coverage`. `UNASSIGNED` is expected and is not a script failure.

See `docs/CONTEXTUAL_MEMORY_ROUTING_CANDIDATE_V0.md`.

### Deterministic selection policy

Among variants that pass admission:

1. authored `priority` (lower wins)
2. `allowedContextIds` order when that allow-list is present; otherwise stable `contextFrameId`
3. stable `variant.id`

Registry insertion order is not a selection rule.

### Supported three-case variants

| Case | Modes that can succeed today | Honest gap |
| --- | --- | --- |
| Meal | `BUILD` (guided then frozen recall), `STRENGTHEN` recall-weakness (guided reconnect/fade then frozen recall), and `RETRIEVE` (safe lexical typing) when `frozen-text-input:TYPE` is present | `STRENGTHEN` IDENTIFY/DISTINGUISH and `PROBE` have no frozen projection |
| School Challenge | none as verified learning | `CLAIM_CHOICE` stays unsupported; Guided presentation is `GUIDED_ONLY` and cannot verify BUILD/STRENGTHEN/PROBE/RETRIEVE |
| Borrowing-Sharing | none as verified learning | contextual `RELATION_CHOICE` stays unsupported; Guided observation is not relational assessment |

Target admission is structured, not sense-only. V0 requires exact `focus` equality, and every requested `requiredRoleIds` / `requiredRelationIds` value must already be present on a covering plan target. Input targets are never rewritten onto the plan. A mismatch returns `PLAN_TARGET_REQUIREMENT_MISMATCH` and the rejected requirement is recorded on the trace.

`SUITABLE_FOR` remains a frame fact, not a universal lexical truth. Requester/owner perspectives must both be requested for borrow/lend variants.

A Guided-only plan may be structurally executable but produces no frozen Evidence. The planner returns `PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE` instead of treating acknowledgement as learning.

Candidate V0 remains Experimental / Not a Standard.

## When Candidate V1 may be discussed

Only after:

- the three skeletons still instantiate three frames without semantic duplication
- claim grounding and borrow/lend perspective tests stay green
- a representative subset still compiles through the frozen evaluator/evidence path
- remaining gaps are explicit, not hidden in renderers
- a separate contract-changing task approves any frozen-semantics change

Passing tests here does not make this module a Standard, production-ready, or a full experience runtime.
