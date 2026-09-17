# Contextual Learning Domain Model Candidate V0

> Status: **Candidate / Not a Standard**
>
> Project: WordRanger
>
> Based on: `CONTEXTUAL_LEARNING_ARCHITECTURE_CANDIDATE.md`
>
> Validation cases: Meal / School Challenge / Borrowing-Sharing
>
> Compatibility rule: **This document does not modify the frozen WordRanger learning semantics.**

---

## 0. Executive decision

V0 introduces a candidate **Contextual Learning Domain** between an already-determined `LearningNeed` and the frozen WordRanger task/evidence runtime.

```text
Frozen Learning Core                         Candidate Contextual Domain

StudentLexemeModel
        ↓
LearningNeed             ───────────────→    ExperiencePlanningInput
                                                ↓
                                         LearningExperiencePlan
                                                ↓
                                         ExperienceStepSpec
                                                ↓ compile
PublicLearningTask       ←───────────────    TaskCompilationRequest
        ↓
StudentAction
        ↓
TaskEvaluator
        ↓
LearningEvidence
        ↓
StudentLexemeModel
```

The candidate domain may decide:

- which meaningful context can carry the target relation;
- which sequence of semantic actions suits the supplied cognitive mode;
- which support block may become available at each step;
- which task capability is required from the existing runtime.

It may not decide:

- the authoritative learner state;
- the authoritative `LearningNeed`;
- whether a learner action is correct;
- how `LearningEvidence` changes `StudentLexemeModel`;
- renderer-specific controls or visual layout.

The three validation cases show that one common model can represent concrete, abstract, and directional/social vocabulary without forcing all learning into a physical scene. They also reveal two areas that must remain explicit in V0: **claim grounding** for abstract concepts and **perspective/direction** for social relations.

---

## 1. Scope and non-goals

### 1.1 V0 goals

V0 must be sufficient to:

1. describe reusable semantic structures independently of presentation;
2. bind lexeme senses to roles, relations, state changes, claims, and actions;
3. instantiate one semantic structure in multiple context variants;
4. express a contextual experience as an ordered sequence of semantic steps;
5. expose support through a bounded support ladder;
6. compile every assessable step into the frozen WordRanger task protocol;
7. preserve provenance and review state for authored or generated content;
8. validate `PROBE`, `BUILD`, `STRENGTHEN`, and `RETRIEVE` without redefining them.

### 1.2 Non-goals

V0 does not define:

- a new scheduler;
- new learner-state semantics;
- new evidence semantics;
- a replacement evaluator;
- final database tables;
- a final authoring format;
- final UI components;
- LLM runtime planning;
- the complete 1600-word content library;
- a cross-subject universal standard.

The TypeScript-like shapes below are domain contracts for review, not production interfaces that must be copied verbatim.

---

## 2. Compatibility boundary with frozen WordRanger semantics

### 2.1 Frozen concepts are referenced, not redefined

```ts
type FrozenLearningNeedRef = string;
type FrozenStudentLexemeModelRef = string;
type FrozenPublicLearningTask = unknown;
type FrozenStudentAction = unknown;
type FrozenLearningEvidence = unknown;
```

The contextual domain receives stable references or read-only projections. It does not create parallel definitions of these concepts.

### 2.2 Required adapter boundary

```ts
interface ExperiencePlanningInput {
  learningNeedRef: FrozenLearningNeedRef;
  learnerStateRef: FrozenStudentLexemeModelRef;
  mode: CognitiveMode;
  targets: ExperienceTarget[];
  allowedContextIds?: ContextFrameId[];
  runtimeCapabilities: RuntimeCapability[];
}

interface TaskCompilationRequest {
  experienceId: ExperienceId;
  step: ExperienceStepSpec;
  resolvedContext: ResolvedContextSnapshot;
  resolvedTargets: ResolvedTargetSnapshot[];
  supportPolicy: StepSupportPolicy;
}

interface TaskCompilationResult {
  stepId: ExperienceStepId;
  publicLearningTask: FrozenPublicLearningTask;
  trace: CompilationTrace;
}
```

`TaskCompilationResult` must contain a valid existing `PublicLearningTask`. No `ContextualEvidence`, `ContextualScore`, or second evaluator is introduced.

### 2.3 Compatibility invariants

| ID | Invariant |
|---|---|
| COMP-01 | `LearningNeed` is supplied by the frozen Learning Core. |
| COMP-02 | `CognitiveMode` is supplied or deterministically mapped outside the context model; Context cannot infer it from presentation. |
| COMP-03 | Every assessable step compiles to an existing supported task/evaluator path. |
| COMP-04 | `StudentAction` remains the learner-response contract. |
| COMP-05 | Correctness is decided only by the existing evaluator. |
| COMP-06 | Only existing `LearningEvidence` updates learner state. |
| COMP-07 | Planning metadata may be logged, but cannot masquerade as learning evidence. |
| COMP-08 | Failure to compile is a content/capability error, not permission to invent new learning semantics. |

---

## 3. Candidate bounded contexts

V0 uses four bounded areas so responsibilities do not collapse into one large schema.

### 3.1 Knowledge Domain

Owns:

- `LexemeSenseRef`;
- semantic concepts;
- sense relations and contrasts;
- misconceptions;
- support content and provenance.

Does not own contexts, learner state, planning, or grading.

### 3.2 Context Domain

Owns:

- reusable `SemanticSkeleton`;
- `ContextFrame` variants;
- role/entity bindings;
- relations, state facts, events, constraints, affordances, and goals.

Does not own cognitive need or grading.

### 3.3 Experience Domain

Owns:

- targets for one experience;
- ordered semantic steps;
- support availability;
- completion structure;
- required runtime capabilities.

Does not determine correctness or update learner state.

### 3.4 Integration Domain

Owns:

- validation of references and capabilities;
- compilation into frozen `PublicLearningTask`;
- traceability from plan step to compiled task;
- reporting content or compilation failures.

Does not reinterpret frozen evaluator output.

---

## 4. Shared primitives

```ts
type LexemeId = string;
type LexemeSenseId = string;
type SemanticConceptId = string;
type SemanticRoleId = string;
type SemanticRelationId = string;
type SemanticSkeletonId = string;
type ContextFrameId = string;
type ContextEntityId = string;
type ContextEventId = string;
type SupportBlockId = string;
type ExperienceId = string;
type ExperienceStepId = string;

type CognitiveMode = "PROBE" | "BUILD" | "STRENGTHEN" | "RETRIEVE";

type ContextKind =
  | "PHYSICAL"
  | "EVENT"
  | "SOCIAL"
  | "PROCEDURAL"
  | "DOMAIN"
  | "CONCEPTUAL"
  | "DISCOURSE";

type SemanticAction =
  | "IDENTIFY"
  | "SELECT"
  | "MATCH"
  | "CLASSIFY"
  | "ORDER"
  | "PLACE"
  | "CONNECT"
  | "COMPARE"
  | "DISTINGUISH"
  | "PREDICT"
  | "CHANGE"
  | "OBSERVE"
  | "EXPLAIN"
  | "RECALL"
  | "TYPE";
```

V0 intentionally omits renderer actions such as `TAP`, `DRAG`, or `CLICK`. Those belong to renderer bindings.

---

## 5. Knowledge model

### 5.1 Lexeme sense reference

```ts
interface LexemeSenseRef {
  lexemeId: LexemeId;
  senseId: LexemeSenseId;
}
```

All contextual bindings target a sense. A temporary one-sense-per-lexeme dataset is allowed, but the reference still carries `senseId`.

### 5.2 Semantic concept

```ts
interface SemanticConcept {
  id: SemanticConceptId;
  label: string;
  kind:
    | "ENTITY_TYPE"
    | "ACTION"
    | "PROPERTY"
    | "RELATION"
    | "STATE"
    | "OUTCOME"
    | "CLAIM";
  gloss: string;
  provenance: Provenance;
}
```

`CLAIM` exists because abstract words such as `possible`, `difficult`, and `success` often need to be grounded in what the context establishes, not mapped to a visible object.

### 5.3 Sense semantic profile

```ts
interface SenseSemanticProfile {
  sense: LexemeSenseRef;
  expresses: SemanticConceptId[];
  functions?: SemanticConceptId[];
  relatedSenses?: SenseRelation[];
  contrastSetIds?: string[];
  misconceptionIds?: string[];
  supportBlockIds?: SupportBlockId[];
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

interface SenseRelation {
  type:
    | "SYNONYM"
    | "ANTONYM"
    | "CONFUSABLE"
    | "WORD_FAMILY"
    | "BROADER"
    | "NARROWER"
    | "ASSOCIATED";
  target: LexemeSenseRef;
}
```

### 5.4 Contrast set and misconception

```ts
interface ContrastSet {
  id: string;
  members: LexemeSenseRef[];
  discriminators: SemanticDiscriminator[];
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

interface SemanticDiscriminator {
  id: string;
  dimension: string;
  rule: SemanticPredicate;
  explanationSupportId?: SupportBlockId;
}

interface Misconception {
  id: string;
  appliesTo: LexemeSenseRef[];
  incorrectClaim: SemanticPredicate;
  correction: SemanticPredicate;
  supportBlockId: SupportBlockId;
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}
```

Example: `borrow` and `lend` share a transfer event but differ by viewpoint and direction. They should therefore live in one contrast set, not in two unrelated definition records.

---

## 6. Semantic skeleton

A `SemanticSkeleton` is a reusable pattern of roles, relations, state transitions, and goals. It contains no artwork, coordinates, named story characters, or lexeme-specific surface text.

```ts
interface SemanticSkeleton {
  id: SemanticSkeletonId;
  version: number;
  title: string;
  description: string;
  supportedContextKinds: ContextKind[];

  roleDefinitions: RoleDefinition[];
  relationDefinitions: RelationDefinition[];
  stateDefinitions?: StateDefinition[];
  eventDefinitions?: EventDefinition[];
  constraintDefinitions?: ConstraintDefinition[];
  affordanceDefinitions?: AffordanceDefinition[];
  goalDefinitions: GoalDefinition[];

  validationRules: SkeletonValidationRule[];
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}
```

### 6.1 Roles

```ts
interface RoleDefinition {
  id: SemanticRoleId;
  label: string;
  cardinality: "ONE" | "OPTIONAL_ONE" | "MANY";
  accepts: SemanticPredicate[];
}
```

Roles are semantic slots such as `EATER`, `EATING_TOOL`, `CHALLENGER`, `OWNER`, or `TEMPORARY_HOLDER`. A role is not a screen object.

### 6.2 Relations

```ts
interface RelationDefinition {
  id: SemanticRelationId;
  label: string;
  fromRole: SemanticRoleId;
  toRole: SemanticRoleId;
  directionality: "DIRECTED" | "SYMMETRIC";
  temporalScope: "STATE" | "EVENT" | "PERSISTENT";
}
```

### 6.3 State and events

```ts
interface StateDefinition {
  id: string;
  subjectRole: SemanticRoleId;
  property: string;
  valueType: "BOOLEAN" | "ENUM" | "NUMBER" | "REFERENCE";
}

interface EventDefinition {
  id: string;
  participantRoles: SemanticRoleId[];
  preconditions: SemanticPredicate[];
  effects: SemanticEffect[];
}
```

### 6.4 Goals and affordances

```ts
interface GoalDefinition {
  id: string;
  description: string;
  successPredicate: SemanticPredicate;
}

interface AffordanceDefinition {
  id: string;
  actorRole: SemanticRoleId;
  action: SemanticAction;
  objectRole?: SemanticRoleId;
  enabledWhen: SemanticPredicate[];
  possibleEffects?: SemanticEffect[];
}
```

An affordance says which meaning-bearing action is possible in the world. It does not say whether the UI uses a tap, card choice, drag, or keyboard.

---

## 7. Context frame and resolved context

### 7.1 Context frame

```ts
interface ContextFrame {
  id: ContextFrameId;
  skeletonId: SemanticSkeletonId;
  title: string;
  kinds: ContextKind[];
  locale: string;

  entityBindings: EntityBinding[];
  initialFacts: SemanticFact[];
  eventBindings?: EventBinding[];
  goalBindings: GoalBinding[];
  narrative?: ContextNarrative;

  allowedSemanticActions: SemanticAction[];
  contentTags: string[];
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}
```

### 7.2 Entity binding

```ts
interface EntityBinding {
  entityId: ContextEntityId;
  roleId: SemanticRoleId;
  conceptIds: SemanticConceptId[];
  lexemeSenseBindings?: ContextLexemeBinding[];
  attributes?: Record<string, string | number | boolean>;
}

interface ContextLexemeBinding {
  sense: LexemeSenseRef;
  bindingKind:
    | "NAMES_ENTITY"
    | "NAMES_ACTION"
    | "NAMES_PROPERTY"
    | "NAMES_RELATION"
    | "NAMES_STATE"
    | "EXPRESSES_CLAIM";
}
```

The additional binding kinds prevent abstract words from being awkwardly treated as object labels.

### 7.3 Semantic facts and predicates

```ts
type SemanticValue =
  | { kind: "ENTITY"; entityId: ContextEntityId }
  | { kind: "ROLE"; roleId: SemanticRoleId }
  | { kind: "CONCEPT"; conceptId: SemanticConceptId }
  | { kind: "LITERAL"; value: string | number | boolean };

interface SemanticFact {
  predicate: string;
  arguments: SemanticValue[];
  truth: true;
}

interface SemanticPredicate {
  predicate: string;
  arguments: SemanticValue[];
  expected: boolean;
}

interface SemanticEffect {
  operation: "ASSERT" | "RETRACT" | "SET";
  fact: SemanticFact;
}
```

V0 uses a small predicate representation rather than embedding arbitrary executable code in content.

### 7.4 Narrative is optional and subordinate

```ts
interface ContextNarrative {
  setup: string;
  eventDescriptions?: Record<ContextEventId, string>;
}
```

A context remains meaningful if its narrative text is removed and the role/relation/state model still explains why the learner action matters. If only the prose carries the meaning, the context is under-modeled.

### 7.5 Resolved snapshot

The planner/compiler works from an immutable resolved snapshot:

```ts
interface ResolvedContextSnapshot {
  contextFrameId: ContextFrameId;
  skeletonId: SemanticSkeletonId;
  entityBindings: EntityBinding[];
  facts: SemanticFact[];
  activeGoalId: string;
  allowedSemanticActions: SemanticAction[];
  sourceVersions: Record<string, number>;
}
```

This prevents content edits during a session from changing the meaning of a task already issued.

---

## 8. Support model

```ts
type SupportType =
  | "HINT"
  | "EXPLANATION"
  | "EXAMPLE"
  | "COUNTER_EXAMPLE"
  | "CONTRAST"
  | "MISCONCEPTION"
  | "ANALOGY"
  | "EXTENSION";

interface SupportBlock {
  id: SupportBlockId;
  type: SupportType;
  appliesToModes: CognitiveMode[];
  targetSenseIds: LexemeSenseId[];
  content: SupportContent;
  revealCost: "NONE" | "LOW" | "MEDIUM" | "ANSWER_REVEALING";
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

type SupportContent =
  | { kind: "TEXT"; text: string }
  | { kind: "SEMANTIC_CUE"; predicates: SemanticPredicate[] }
  | { kind: "CONTRAST"; contrastSetId: string; focus: string }
  | { kind: "PARTIAL_LEXICAL_CUE"; pattern: string }
  | { kind: "EXAMPLE_CONTEXT"; contextFrameId: ContextFrameId };
```

### 8.1 Support ladder

```ts
interface StepSupportPolicy {
  initialSupportBlockIds: SupportBlockId[];
  ladder: SupportLevel[];
  optionalExtensionBlockIds?: SupportBlockId[];
}

interface SupportLevel {
  level: 0 | 1 | 2 | 3 | 4;
  trigger: "ON_REQUEST" | "AFTER_FAILED_ATTEMPT" | "AFTER_N_FAILURES";
  supportBlockIds: SupportBlockId[];
  permitsAnotherAttempt: boolean;
}
```

Constraints:

- Level 0 contains no answer-revealing support.
- A full answer may appear only at the terminal support level.
- A terminal reveal never counts as independent retrieval.
- Whether and how that attempt becomes evidence remains governed by frozen semantics.

---

## 9. Experience model

### 9.1 Target

```ts
interface ExperienceTarget {
  id: string;
  sense: LexemeSenseRef;
  focus:
    | "FORM_TO_MEANING"
    | "MEANING_TO_FORM"
    | "CONTEXT_INTERPRETATION"
    | "DISCRIMINATION"
    | "RELATION_USE";
  requiredRoleIds?: SemanticRoleId[];
  requiredRelationIds?: SemanticRelationId[];
}
```

`focus` describes what the plan must exercise. It is not a new learner-state dimension and does not change existing evidence semantics.

### 9.2 Learning experience plan

```ts
interface LearningExperiencePlan {
  id: ExperienceId;
  schemaVersion: "candidate-v0";
  mode: CognitiveMode;
  sourceLearningNeedRef: FrozenLearningNeedRef;
  targets: ExperienceTarget[];

  skeletonId: SemanticSkeletonId;
  contextFrameId: ContextFrameId;
  activeGoalId: string;

  steps: ExperienceStepSpec[];
  completionPolicy: ExperienceCompletionPolicy;
  provenance: Provenance;
}
```

### 9.3 Experience step

```ts
interface ExperienceStepSpec {
  id: ExperienceStepId;
  purpose:
    | "GROUND"
    | "CONNECT"
    | "DISCRIMINATE"
    | "GENERATE"
    | "RECALL"
    | "TRANSFER"
    | "OBSERVE";

  targetIds: string[];
  semanticAction: SemanticAction;
  promptIntent: PromptIntent;
  expectedResponse: ExpectedSemanticResponse;
  supportPolicy: StepSupportPolicy;
  requiredCapabilities: RuntimeCapability[];
  transition: StepTransitionPolicy;
}

interface PromptIntent {
  instructionKey: string;
  semanticQuestion: SemanticPredicate | SemanticQuery;
  mustNotRevealTargetForm?: boolean;
}

interface SemanticQuery {
  query: string;
  arguments: SemanticValue[];
}

type ExpectedSemanticResponse =
  | { kind: "ENTITY_REF"; allowedEntityIds: ContextEntityId[] }
  | { kind: "RELATION_CHOICE"; allowedRelationIds: SemanticRelationId[] }
  | { kind: "ORDERED_ENTITY_REFS"; allowedSequences: ContextEntityId[][] }
  | { kind: "LEXICAL_FORM"; sense: LexemeSenseRef }
  | { kind: "SEMANTIC_CLASS"; allowedConceptIds: SemanticConceptId[] }
  | { kind: "CLAIM_CHOICE"; allowedPredicates: SemanticPredicate[] };
```

The expected response is semantic. The compiler translates it into the answer representation supported by an existing task/evaluator.

### 9.4 Completion policy

```ts
interface ExperienceCompletionPolicy {
  requiredStepIds: ExperienceStepId[];
  terminalStepIds: ExperienceStepId[];
  onCompilationFailure: "ABORT_PLAN" | "SELECT_COMPATIBLE_VARIANT";
}

interface StepTransitionPolicy {
  onTaskCompleted: "NEXT" | "END";
  onSupportExhausted: "NEXT" | "END" | "USE_PREAUTHORED_FALLBACK_STEP";
  fallbackStepId?: ExperienceStepId;
}
```

V0 does not branch on newly interpreted scores. Any branch signal must be an existing, explicitly supported runtime outcome.

---

## 10. Runtime capability model

The planner matches semantic requirements to available runtime capabilities; it does not select a renderer by name.

```ts
interface RuntimeCapability {
  id: string;
  supportsAction: SemanticAction;
  responseKinds: ExpectedSemanticResponse["kind"][];
  maxOptions?: number;
  supportsContextSnapshot: boolean;
  supportsHintReveal: boolean;
  compilerId: string;
}

interface RendererBinding {
  capabilityId: string;
  rendererId: string;
  interactionMapping: Record<string, string>;
}
```

Example:

```text
semantic action: IDENTIFY
expected response: ENTITY_REF
capability: CHOOSE_ONE_ENTITY

possible renderer A: select a scene object
possible renderer B: select a card
possible renderer C: move a character to an object
```

The contextual plan remains unchanged across those renderer choices.

---

## 11. Provenance and review

```ts
type ProvenanceKind =
  | "SOURCE"
  | "CURATED"
  | "EXTERNAL_REFERENCE"
  | "MODEL_GENERATED"
  | "INFERRED";

type ReviewStatus =
  | "DRAFT"
  | "REVIEW_REQUIRED"
  | "REVIEWED"
  | "REJECTED";

interface Provenance {
  kind: ProvenanceKind;
  sourceIds?: string[];
  authoringAgent?: string;
  confidence?: number;
  createdAt: string;
}
```

Rules:

- `MODEL_GENERATED` or `INFERRED` learning content cannot be published without an explicit allowed review policy.
- Provenance applies to skeletons, contexts, semantic profiles, support blocks, and experience plans.
- A compiled task retains trace IDs back to all content units that supplied its meaning.

---

## 12. Validation case A — Meal

### 12.1 What this case must prove

- concrete entities, functions, and actions fit naturally;
- one skeleton survives three context variants;
- target words bind to semantic roles, not screen coordinates;
- transfer changes the surface context without rewriting knowledge.

### 12.2 Skeleton

```yaml
id: meal-setting-v0
roles:
  - EATER
  - FOOD
  - FOOD_CONTAINER
  - EATING_TOOL
  - DRINK
  - DRINK_CONTAINER
relations:
  - CONTAINS(FOOD_CONTAINER -> FOOD)
  - CONTAINS(DRINK_CONTAINER -> DRINK)
  - SUITABLE_FOR(EATING_TOOL -> FOOD)
events:
  - CHOOSE_TOOL(EATER, EATING_TOOL, FOOD)
goals:
  - EATER_CAN_EAT_FOOD
```

Candidate lexeme senses:

```text
spoon, fork, knife, bowl, plate, cup, soup, eat, drink, choose
```

Contrast examples:

```text
spoon vs fork: suitability for soup / soft food vs piercing pieces
bowl vs plate: containing food with liquid vs supporting flatter food
cup vs bowl: primary use for drinking vs holding food
```

### 12.3 Context variants

| Frame | Stable skeleton roles | Surface/entity differences |
|---|---|---|
| Home breakfast | eater, food, container, tool | named kitchen setting; soup/oatmeal; household objects |
| Restaurant meal | same | customer/table setting; waiter may supply items |
| Picnic lunch | same | outdoor setting; portable objects; different food set |

No skeleton relation changes when the context changes. Only entity bindings, facts, narrative, and available distractors change.

### 12.4 Mode examples

| Mode | Candidate step sequence |
|---|---|
| PROBE | Given soup, identify a suitable tool → recall the tool name without support. |
| BUILD | Observe food/tool relation → bind `spoon` → contrast spoon/fork → choose in restaurant → recall `spoon`. |
| STRENGTHEN | Start with ambiguous tool choice → provide function cue after failure → distinguish spoon/fork → recall later in picnic. |
| RETRIEVE | Minimal context: “You need to eat soup” → type `spoon`. |

### 12.5 Example plan fragment

```yaml
mode: BUILD
target: spoon#eating-utensil
context: home-breakfast-v0
steps:
  - purpose: GROUND
    action: IDENTIFY
    question: Which object makes the active meal goal possible?
    expected: entity(spoon-1)
  - purpose: DISCRIMINATE
    action: DISTINGUISH
    question: Which tool is suitable for soup rather than for piercing food?
    expected: entity(spoon-1)
  - purpose: TRANSFER
    action: SELECT
    context: restaurant-meal-v0
    expected: entity(restaurant-spoon-1)
  - purpose: RECALL
    action: TYPE
    question: Produce the English word for the required tool.
    expected: lexical-form(spoon#eating-utensil)
```

### 12.6 Result

**Pass, provisionally.** The skeleton is reusable because the stable part is the goal/function/relation structure. The physical setting is useful but not required to own the learning logic.

Risk discovered: `SUITABLE_FOR` depends on the specific food state and cultural/task context. It must be represented as a contextual fact, not a universal lexical truth.

---

## 13. Validation case B — School Challenge

### 13.1 What this case must prove

- abstract vocabulary does not require fake objectification;
- words can bind to properties, states, outcomes, and claims;
- the context provides evidence for a claim rather than merely decorating a multiple-choice question.

### 13.2 Skeleton

```yaml
id: goal-directed-challenge-v0
roles:
  - CHALLENGER
  - CHALLENGE
  - SKILL
  - ATTEMPT
  - STRATEGY
  - OUTCOME
states:
  - skill-level(CHALLENGER, SKILL)
  - challenge-requirement(CHALLENGE, SKILL)
  - attempt-status(ATTEMPT)
relations:
  - USES(ATTEMPT -> STRATEGY)
  - TARGETS(ATTEMPT -> CHALLENGE)
events:
  - TRY
  - PRACTICE
  - RECEIVE_FEEDBACK
  - RETRY
goals:
  - COMPLETE_CHALLENGE
```

Candidate lexeme senses:

```text
ability, possible, difficult, try, improve, practice, success, fail,
challenge, result, plan, confident
```

### 13.3 Abstract bindings

| Sense | Binding kind | Grounding in context |
|---|---|---|
| ability | NAMES_PROPERTY | current capacity of challenger relative to a skill |
| difficult | EXPRESSES_CLAIM | challenge requirement is high relative to current ability/resources |
| possible | EXPRESSES_CLAIM | at least one allowed plan can satisfy the goal under current facts |
| try | NAMES_ACTION | challenger performs an attempt toward the goal |
| improve | NAMES_STATE | later measured skill/performance exceeds earlier state |
| success | NAMES_OUTCOME | goal predicate is satisfied, not merely “a high score” in every context |

This table is a key V0 finding: abstract vocabulary often describes an interpretation of a structured event. It should not be forced into `NAMES_ENTITY`.

### 13.4 Context variants

| Frame | Same skeleton | Variant bindings |
|---|---|---|
| Science tower challenge | build a stable paper tower | skill, attempts, design strategies, stability outcome |
| School quiz team | answer a set of questions together | knowledge skill, preparation, answer outcomes |
| Sports-day relay planning | complete a relay goal | running/coordination skill, role plan, completion outcome |

The skeleton remains stable: agent + goal + requirements + attempt + feedback + changed state/outcome.

### 13.5 Mode examples

| Mode | Candidate step sequence |
|---|---|
| PROBE | Read event evidence → distinguish `try` from `success` → choose which claim is supported. |
| BUILD | Ground attempt and outcome → connect practice to changed ability → discriminate difficult/impossible → recall target in a new challenge. |
| STRENGTHEN | Present evidence where effort occurs without goal completion → contrast `try`/`success` → minimal lexical cue if needed. |
| RETRIEVE | Give a reduced event description and require the target word or correct claim. |

### 13.6 Example discrimination

Context facts:

```text
The tower fell on attempt 1.
The learner changed the base design.
The tower stood for 30 seconds on attempt 2.
The goal requires standing for 20 seconds.
```

Semantic conclusions supported by the model:

```text
attempt 1 = try, not success
performance improved between attempts
attempt 2 satisfied the goal = success
```

Unsupported conclusion:

```text
The learner has high general ability in every building task.
```

This illustrates why abstract-word tasks need fact-to-claim grounding and must avoid overgeneralization.

### 13.7 Result

**Pass with a required schema addition.** Entity/role/relation modeling alone is insufficient. V0 needs `STATE`, `OUTCOME`, and especially `CLAIM` bindings plus explicit predicates that justify those claims.

Risk discovered: terms such as `difficult`, `possible`, `ability`, and `success` are context-sensitive. Authoring must specify the comparison baseline or goal predicate; otherwise the learning content can become vague or logically wrong.

---

## 14. Validation case C — Borrowing-Sharing

### 14.1 What this case must prove

- social vocabulary is modeled as participant roles and directional relations;
- `borrow` and `lend` share one event but use different perspectives;
- temporary possession and ownership are not conflated;
- `share`, `give`, and `take` can be distinguished by state transitions.

### 14.2 Skeleton

```yaml
id: temporary-resource-access-v0
roles:
  - OWNER
  - REQUESTER
  - ITEM
  - TEMPORARY_HOLDER
relations:
  - OWNS(OWNER -> ITEM)
  - REQUESTS_FROM(REQUESTER -> OWNER)
  - TEMPORARILY_POSSESSES(TEMPORARY_HOLDER -> ITEM)
events:
  - REQUEST_ACCESS
  - ACCEPT_REQUEST
  - REFUSE_REQUEST
  - TRANSFER_TEMPORARY_POSSESSION
  - USE_TOGETHER
  - RETURN_ITEM
goals:
  - REQUESTER_CAN_USE_ITEM_WITHOUT_CHANGING_OWNERSHIP
```

Candidate lexeme senses:

```text
borrow, lend, share, give, take, return, ask, accept, refuse, own, use
```

### 14.3 Event perspectives

```ts
interface PerspectiveBinding {
  eventId: string;
  observerRole: SemanticRoleId;
  expressedSense: LexemeSenseRef;
  requiredDirection: {
    sourceRole: SemanticRoleId;
    destinationRole: SemanticRoleId;
  };
}
```

Example:

```text
same event: temporary transfer of a ruler from Maya to Leo

Leo's perspective:
Leo borrows the ruler from Maya.

Maya's perspective:
Maya lends the ruler to Leo.
```

`borrow` and `lend` cannot be correctly represented without explicit source, destination, and observer/subject perspective.

### 14.4 State transitions

| Word | Ownership after event | Possession/access after event | Expected return |
|---|---|---|---|
| borrow | unchanged | borrower gains temporary possession | yes |
| lend | unchanged | recipient gains temporary possession | yes |
| give | usually changes | recipient gains possession | normally no |
| share | may be unchanged | two or more participants gain joint/concurrent access | context-dependent |
| take | not determined by the word alone | taker gains possession/control | not determined |
| return | restored to prior holder/owner | temporary holder gives possession back | completes temporary-transfer cycle |

These are candidate semantic discriminators, not dictionary definitions. Content authors must bind the relevant sense and context.

### 14.5 Context variants

| Frame | Same skeleton | Variant bindings |
|---|---|---|
| Borrow a ruler in class | owner/student/item | clear temporary possession and return |
| Share colored pencils for a poster | group use | concurrent or coordinated access emphasizes `share` |
| Borrow a library book | institution/member/item | due date and return event; ownership remains with library |

### 14.6 Mode examples

| Mode | Candidate step sequence |
|---|---|
| PROBE | Observe direction and perspective → choose `borrow` or `lend` → later type the verb. |
| BUILD | Ground ownership/possession → enact temporary transfer → label from requester view → relabel from owner view → contrast with give/share → recall. |
| STRENGTHEN | Keep event fixed but switch grammatical subject → ask for the matching verb → reveal directional cue after failure. |
| RETRIEVE | Minimal relation graph or sentence frame → independently produce `borrow`/`lend`. |

### 14.7 Example plan fragment

```yaml
mode: STRENGTHEN
targets:
  - borrow#temporary-receive
  - lend#temporary-provide
context: classroom-ruler-v0
steps:
  - purpose: OBSERVE
    action: ORDER
    expected: [maya-has-ruler, maya-to-leo, leo-to-maya]
  - purpose: DISCRIMINATE
    action: SELECT
    subject: leo
    expected: borrow#temporary-receive
  - purpose: DISCRIMINATE
    action: SELECT
    subject: maya
    expected: lend#temporary-provide
  - purpose: RECALL
    action: TYPE
    context: library-book-v0
    expected: borrow#temporary-receive
```

### 14.8 Result

**Pass with a required schema addition.** V0 needs explicit `PerspectiveBinding` or an equivalent subject/viewpoint constraint. A generic `TRANSFER` relation is too weak and would produce incorrect `borrow/lend` tasks.

Risk discovered: grammatical frame matters (`borrow X from Y`, `lend X to Y`). V0 can represent semantic direction, but lexical construction/collocation may require a later, separate language-realization layer. It should not be smuggled into renderer text.

---

## 15. Cross-case validation matrix

| Requirement | Meal | School Challenge | Borrowing-Sharing | V0 result |
|---|---:|---:|---:|---|
| Reusable skeleton across 3 variants | Yes | Yes | Yes | Supported |
| Concrete entity binding | Strong | Limited | Strong | Supported |
| Action/event binding | Yes | Strong | Strong | Supported |
| Abstract property/state binding | Limited | Essential | Some | Add explicit binding kinds |
| Fact-grounded claim | Minor | Essential | Useful | Required in V0 |
| Directional relation | Minor | Some | Essential | Required in V0 |
| Perspective switch | No | Possible | Essential | Required for relevant contexts |
| Contrast/misconception | Yes | Yes | Essential | First-class data |
| Context transfer | Yes | Yes | Yes | Supported |
| All four cognitive modes | Yes | Yes | Yes | Representable; runtime validation still needed |
| Existing task compilation | Plausible | Plausible | Plausible | Not proven until adapter spike |

Conclusion:

> The same domain model can cover all three cases only if context is treated as structured semantics—not as a physical scene—and if bindings can target entities, actions, properties, relations, states, outcomes, and claims.

---

## 16. Aggregate rules and validation errors

### 16.1 `SemanticSkeleton` aggregate

Must reject:

- relations whose roles do not exist;
- events whose participant roles do not exist;
- goals whose predicates reference unknown roles/concepts;
- renderer identifiers or coordinates inside the skeleton;
- lexeme surface strings embedded as required role identities.

### 16.2 `ContextFrame` aggregate

Must reject:

- missing required role bindings;
- facts referencing unknown entities;
- context actions not licensed by the skeleton affordances;
- active goals not defined by the skeleton;
- lexeme bindings without a sense ID;
- abstract claims with no grounding predicate;
- directional-event words without direction/perspective information where required.

### 16.3 `LearningExperiencePlan` aggregate

Must reject:

- no source `LearningNeed` reference;
- target senses not bound or semantically reachable in the context;
- a step with no matching runtime capability;
- `RECALL` whose prompt reveals the answer form;
- a support ladder that reveals the full answer before weaker cues;
- completion rules that directly update learner state;
- expected responses that cannot compile into an existing evaluator contract.

### 16.4 Suggested error codes

```text
CTX_UNKNOWN_ROLE
CTX_MISSING_REQUIRED_BINDING
CTX_UNGROUNDED_CLAIM
CTX_AMBIGUOUS_DIRECTION
CTX_MISSING_PERSPECTIVE
EXP_TARGET_NOT_REACHABLE
EXP_UNSUPPORTED_SEMANTIC_ACTION
EXP_NO_RUNTIME_CAPABILITY
EXP_RECALL_LEAKS_ANSWER
EXP_INVALID_SUPPORT_ORDER
COMPILATION_UNSUPPORTED_RESPONSE_KIND
COMPILATION_FROZEN_CONTRACT_MISMATCH
```

---

## 17. Candidate authoring package

For pilot content, one reviewable package should contain:

```text
ContextualContentPackage
├── semantic concepts
├── lexeme-sense profiles
├── contrast sets and misconceptions
├── one semantic skeleton
├── three context frames
├── support blocks
├── four mode-specific experience templates
├── validation fixtures
└── provenance/review metadata
```

The package should be independently valid before UI rendering.

Suggested file separation for a later implementation spike:

```text
context-domain/
  schema/
  validation/
  fixtures/
    meal/
    school-challenge/
    borrowing-sharing/
  compilation/
```

This is a suggested organization, not a repository change requested by V0.

---

## 18. Required tests before V0 can advance

### 18.1 Schema tests

- resolve every role/relation/event reference;
- reject surface lexeme binding without `senseId`;
- reject ungrounded abstract claim;
- reject ambiguous borrow/lend event;
- verify immutable resolved snapshots;
- verify provenance and review status are retained.

### 18.2 Cross-variant tests

For every skeleton:

1. instantiate three context frames;
2. run the same experience template against each;
3. allow only binding/narrative/distractor changes;
4. fail if the skeleton or target semantic rule must be rewritten.

### 18.3 Compilation contract tests

- each `ExpectedSemanticResponse.kind` used by pilots compiles to an existing task;
- compiled task is accepted by the existing task schema;
- existing evaluator can score the resulting `StudentAction`;
- emitted evidence is an existing `LearningEvidence` form;
- no candidate-only field is required by the evaluator.

### 18.4 Mode tests

- PROBE does not assume `UNSEEN = unknown`;
- BUILD uses a multi-step sequence and ends with reduced-support recall;
- STRENGTHEN targets the supplied weak path rather than reteaching everything;
- RETRIEVE begins with minimal support;
- terminal answer reveal is distinguishable from independent retrieval using existing runtime behavior only.

### 18.5 Pedagogical review tests

- the learner uses meaning to act, rather than only recognizes a translated label;
- context facts are sufficient to justify the expected answer;
- distractors are wrong for a semantic reason, not merely visually different;
- abstract claims do not overgeneralize beyond the presented evidence;
- switching context tests transfer without introducing unrelated difficulty.

---

## 19. Decisions made in Candidate V0

| ID | Candidate decision | Reason |
|---|---|---|
| DM-V0-01 | Keep the contextual domain downstream of `LearningNeed`. | Preserves Learning Core authority. |
| DM-V0-02 | Bind contexts to lexeme senses, never only surface lexemes. | Avoids future polysemy trap. |
| DM-V0-03 | Separate skeleton, frame, experience, task compilation, and renderer. | Enables reuse and prevents responsibility leakage. |
| DM-V0-04 | Make roles/relations/states/events/goals first-class. | Context must carry meaning. |
| DM-V0-05 | Add binding kinds for action/property/relation/state/outcome/claim. | Required by abstract vocabulary validation. |
| DM-V0-06 | Model direction and perspective explicitly. | Required for borrow/lend correctness. |
| DM-V0-07 | Represent expected responses semantically. | Keeps plans renderer-independent. |
| DM-V0-08 | Compile into existing `PublicLearningTask`. | Avoids a second learning engine. |
| DM-V0-09 | Keep support blocks separate and progressively revealed. | Supports retrieval before answer exposure. |
| DM-V0-10 | Start with deterministic, preauthored plans/templates. | Makes pilot behavior reviewable and testable. |

These are candidate decisions. Promotion requires implementation evidence.

---

## 20. Unresolved questions

### Must resolve before implementation beyond a schema spike

1. Which current `PublicLearningTask` variants can compile `ENTITY_REF`, `RELATION_CHOICE`, `LEXICAL_FORM`, and `CLAIM_CHOICE` without semantic changes?
2. Which existing runtime outcome can safely drive fallback-step transitions?
3. How are hints currently represented, and can support use be preserved without changing evidence meaning?
4. Does the frozen learner model distinguish recognition, active recall, confusion, and contextual understanding strongly enough for the proposed targets?
5. Where does lexical realization live for grammatical frames such as `borrow ... from ...` and `lend ... to ...`?

### Can remain open during the pilot

6. Whether `ContextFrame` and `ContextVariant` should remain distinct production types.
7. Whether predicates should use JSON Logic, a small DSL, or validated tagged unions.
8. Whether one experience may span two context frames directly or compiles into linked plans.
9. Whether optional extensions belong in the same plan or a separate non-assessed content request.
10. How authoring tools visualize skeleton/frame separation.

---

## 21. Recommended next implementation step

Do not implement the full planner or new UI yet.

Build one **domain-only executable fixture spike**:

```text
1. Encode the three skeletons.
2. Encode three context frames per skeleton.
3. Encode one BUILD and one STRENGTHEN plan template per skeleton.
4. Run structural validators.
5. Attempt compilation of one step of each response kind into current tasks.
6. Record every frozen-contract mismatch without altering the frozen contract.
```

The exit criterion is not “the demo looks good.” It is:

```text
same skeleton + different frame
→ valid resolved context
→ valid semantic step
→ valid existing PublicLearningTask
→ existing StudentAction/Evaluator/Evidence path
```

If any step cannot compile, V0 should record a capability gap. It must not silently extend frozen learning semantics.

---

## 22. Candidate acceptance criteria

V0 may advance to `Candidate V1` only when:

- all three skeletons instantiate three variants without semantic duplication;
- abstract claim grounding passes review;
- borrow/lend direction and perspective tests pass;
- at least one plan per cognitive mode is represented for each case;
- every pilot step has a declared runtime capability;
- a representative subset compiles and runs through the frozen pipeline;
- learner-state changes come only from existing evidence processing;
- open contract gaps are explicit and not hidden in content or renderers.

V0 must not be called a Standard solely because its schemas are internally consistent.

---

## 23. Final assessment

The three cases support a single candidate domain model:

```text
Knowledge meaning
        +
Reusable semantic skeleton
        +
Context-specific bindings and facts
        +
Cognitive-mode experience plan
        +
Semantic expected response
        ↓
Compile into frozen WordRanger task semantics
```

Meal proves functional physical context and transfer. School Challenge proves that the model must ground abstract properties, states, outcomes, and claims. Borrowing-Sharing proves that social vocabulary requires explicit direction, ownership/possession state, and perspective.

Therefore the V0 candidate is coherent enough for a domain-fixture and adapter spike, but not yet stable enough to change WordRanger production semantics or become a project standard.

