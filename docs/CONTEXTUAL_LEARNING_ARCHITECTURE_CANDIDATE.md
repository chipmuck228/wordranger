# CONTEXTUAL_LEARNING_ARCHITECTURE_CANDIDATE

> Status: **Candidate / Not a Standard**
>
> Project context: WordRanger
>
> Purpose: Preserve the current design discussion so a new conversation can continue from a stable written baseline without re-deriving the architecture.
>
> This document intentionally describes a **candidate architecture**. It should be validated with real vocabulary cases before becoming a project standard.

---

## 1. Why this document exists

WordRanger began as a vocabulary-learning game with a stable learning pipeline:

```text
Vocabulary Domain
→ StudentLexemeModel
→ Learning Need
→ Scheduler
→ PublicLearningTask
→ Renderer
→ StudentAction
→ TaskEvaluator
→ LearningEvidence
→ StudentLexemeModel
```

That architecture remains valuable and should not be replaced.

The current design discussion identified a higher-level product problem:

> A learner may need either to **build a memory that is not yet reliable**, or to **retrieve and strengthen a memory that already exists but is weak or fading**.

These are not the same cognitive process and should not be represented by the same UI or the same learning experience.

The proposed migration is therefore to insert a **Contextual Learning / Cognitive Experience Layer** between Learning Need and task generation, while preserving the existing task/evidence pipeline underneath.

---

## 2. Product thesis

The central product idea is:

> **WordRanger should know when a word needs memory formation and when it only needs memory retrieval/strengthening, and it should use different experiences for those two cases.**

The user is not expected to understand those internal modes.

From the learner's perspective, the app should feel like:

> “I am using what I already know to complete meaningful tasks, and while doing that, the words I am weak on become stronger.”

The app should not feel like:

> “I am repeatedly reading, reciting, or spelling one word simply because I am trying to memorize it.”

---

## 3. User assumptions

The current intended learner is not a complete beginner.

Important facts:

1. The learner already has some vocabulary knowledge.
2. The learner also learns words in school/class.
3. The app therefore does not need to act as the only first-teaching source.
4. The app should discover what remains after classroom learning.
5. The learner simultaneously has:
   - words that are already stable;
   - words that are recognizable but weak;
   - words that are confused with others;
   - words that cannot be actively recalled;
   - words that appear to have no reliable memory representation.
6. The learner may have a concrete vocabulary goal, e.g.:
   - Junior-high 1600-word scope;
   - Senior-high vocabulary;
   - a textbook range;
   - an exam-oriented vocabulary set.

Therefore the product objective is:

```text
discover current mastery
→ strengthen weak existing memories
→ build missing memories
→ verify independent retrieval
→ revisit after delay
```

---

## 4. Build memory vs retrieve memory

### 4.1 Memory formation

Memory formation is a longer process.

It should not be reduced to:

```text
show word
→ show translation
→ repeat
→ repeat
→ repeat
```

A stronger candidate process is:

```text
GROUND
→ CONNECT
→ DISCRIMINATE
→ GENERATE
→ RECALL
→ REVISIT
```

Meaning:

- **GROUND**: bind a new word to a meaningful object, event, concept, relationship, or situation.
- **CONNECT**: connect it to prior knowledge, related concepts, functions, categories, actions, or existing vocabulary.
- **DISCRIMINATE**: clarify what it is not, especially nearby concepts and confusing words.
- **GENERATE**: require the learner to do something with it rather than merely look at it.
- **RECALL**: remove the main support and require the learner to retrieve the word/concept.
- **REVISIT**: return later to verify that the retrieval path survived over time.

### 4.2 Retrieval / strengthening

A weak existing memory should not be “retaught” from the beginning.

The goal is:

```text
cue
→ attempt retrieval
→ minimal help if necessary
→ successful retrieval
→ later retrieval again
```

Support should increase gradually, rather than immediately revealing the answer.

Example:

```text
Level 0
no help

↓ failure

Level 1
context/function cue

↓ failure

Level 2
contrast or visual cue

↓ failure

Level 3
partial lexical cue

↓ failure

Level 4
full answer

↓
later independent retrieval
```

The learner should experience:

> “I nearly remembered it, then a small clue helped me recover it.”

rather than:

> “The app taught me the same word again.”

---

## 5. High-level cognitive modes

The candidate framework currently uses four internal cognitive modes:

```text
PROBE
BUILD
STRENGTHEN
RETRIEVE
```

These are **system concepts**, not student-facing UI labels.

### PROBE

Goal: discover what the learner currently has.

Examples:

- can recognize meaning;
- can actively recall;
- can distinguish nearby words;
- can understand in context.

Important invariant:

> `UNSEEN` means no reliable evidence, not “the learner does not know the word.”

Therefore new users must not automatically enter BUILD for every unseen word.

### BUILD

Use when there is evidence that a reliable memory representation has not been established.

BUILD is a multi-step experience and may include:

- context grounding;
- explanation;
- semantic relation;
- function;
- comparison;
- misconception correction;
- transfer to another context;
- final independent retrieval.

### STRENGTHEN

Use when some representation already exists but a specific path is weak.

Examples:

- recognizes English → Chinese but cannot produce Chinese → English;
- knows the word but confuses it with a neighbor;
- retrieves too slowly;
- relies on hints;
- memory is fading.

STRENGTHEN should target the weak connection rather than restart the whole word.

### RETRIEVE

Use minimal support.

Goal:

> Require the learner to independently retrieve or apply the knowledge.

This is also the final validation step after BUILD or STRENGTHEN.

---

## 6. Context is not decoration

A central principle:

> **Context must carry meaning, not decoration.**

Bad example:

```text
[pretty kitchen background]

spoon

A. 勺子
B. 盘子
C. 杯子
D. 锅
```

The kitchen is merely visual decoration.

A meaningful context would make the environment part of the cognitive task:

```text
There is soup on the table.

What do you need?
```

The learner must understand the role and relation of the object to solve the task.

Therefore a Context is better defined as:

> **A structured world in which certain knowledge relations are meaningful and certain learner actions are possible.**

---

## 7. Context is broader than a physical scene

“Scene” is too narrow as a long-term concept.

A unified engine must support junior-high concrete words as well as senior-high abstract, scientific, commercial, technical, and academic vocabulary.

Therefore the broader concept is:

> **Context Frame**

Candidate context types include:

```text
PHYSICAL
EVENT
SOCIAL
PROCEDURAL
DOMAIN
CONCEPTUAL
DISCOURSE
```

Examples:

- **PHYSICAL**: Kitchen, restaurant, station, laboratory.
- **EVENT**: Missing a bus, a school competition, a medical visit.
- **SOCIAL**: Invitation, disagreement, negotiation.
- **PROCEDURAL**: Buying a ticket, conducting an experiment, starting a company.
- **DOMAIN**: Business, technology, environment, science.
- **CONCEPTUAL**: Cause/effect, risk, evidence, comparison.
- **DISCOURSE**: Argument, explanation, report, academic discussion.

Thus `spoon` and `revenue` can live in the same framework even though they require very different contexts.

---

## 8. Context variants and transfer

A word should not be permanently tied to one context.

Example:

```text
spoon
├─ Kitchen
├─ Restaurant
├─ Picnic
└─ Camping
```

The purpose is to prevent:

```text
Kitchen → spoon
```

from becoming the only retrieval association.

A useful progression is:

```text
primary context
→ transfer context
→ reduced-context cue
→ independent retrieval
```

This supports generalization.

---

## 9. Separate the semantic skeleton from the visual context

The core design should separate:

```text
Semantic Skeleton
```

from:

```text
Context Variant / Scene Instance
```

Example semantic skeleton:

```text
MEAL_SETTING

roles:
- FOOD_CONTAINER
- EATING_TOOL
- DRINK_CONTAINER
- FOOD_SURFACE

relations:
- CONTAINS
- USED_FOR
- EAT_WITH
- NEXT_TO
```

Role bindings:

```text
EATING_TOOL → spoon
FOOD_CONTAINER → bowl
FOOD_SURFACE → plate
DRINK_CONTAINER → cup
```

The same skeleton can be rendered as:

```text
Kitchen
Restaurant
Picnic
School Cafeteria
Camping
```

This is the core “game-engine-like” separation:

```text
knowledge structure
≠
scene
≠
renderer
```

---

## 10. Knowledge structure

The system must not store only:

```text
word = translation
```

It needs richer semantic data.

Conceptually:

```text
Lexeme
  ↓
Sense
  ↓
Meaning
Relations
Contrast
Function
Usage
Misconceptions
Context Bindings
```

For example:

```text
spoon

category:
eating utensil

function:
scoop / eat liquid or soft food

contrast:
fork
knife

related:
bowl
soup
eat
```

For:

```text
revenue

core concept:
money/income received by a business

related:
income
sales
profit
cost

contrast:
revenue ≠ profit

relations:
sales → revenue
revenue - costs → profit
```

This same conceptual model can support junior-high and senior-high vocabulary.

---

## 11. Sense-level binding

Future data should be designed so that context binds to a word **sense**, not blindly to the entire surface lexeme.

Conceptually:

```text
Lexeme
  ↓
Sense
  ↓
ContextBinding
```

Example:

```text
issue

Sense A:
problem

Sense B:
issue a document

Sense C:
an issue of a magazine
```

If all contexts bind directly to the surface form `issue`, the system will eventually become ambiguous and hard to maintain.

The MVP does not need a complete lexical-sense system, but the schema should not make future sense-level extension impossible.

---

## 12. Learning support is first-class data

A Contextual Learning Engine needs more than definitions.

It should be capable of carrying:

```text
HINT
EXPLANATION
EXAMPLE
COUNTER_EXAMPLE
CONTRAST
MISCONCEPTION
ANALOGY
EXTENSION
```

Potential future types:

```text
COLLOCATION
WORD_FORMATION
ETYMOLOGY
REGISTER
ACADEMIC_USAGE
```

Important principle:

> The data layer may contain many forms of support; the UI should show only what the current cognitive need requires.

The system should distinguish:

- **Task hint**: helps the learner continue the current task.
- **Immediate explanation**: corrects a misunderstanding.
- **Extension**: optional deeper information requested by the learner.

---

## 13. Support should be block-based

Avoid a huge fixed schema such as:

```text
explanation
example
example2
counterExample
hint1
hint2
hint3
analogy
...
```

Prefer composable blocks:

```ts
interface SupportBlock {
  id: string;
  type:
    | "HINT"
    | "EXPLANATION"
    | "EXAMPLE"
    | "COUNTER_EXAMPLE"
    | "CONTRAST"
    | "MISCONCEPTION"
    | "ANALOGY"
    | "EXTENSION";

  appliesTo:
    | "BUILD"
    | "STRENGTHEN"
    | "RETRIEVE";

  content: unknown;
  provenance: Provenance;
}
```

This keeps the schema extensible without making every lexeme record enormous.

---

## 14. Contrast and misconception are important primary data

A learner must not only know:

```text
what A is
```

but also:

```text
why A is not B
```

Examples:

```text
borrow vs lend
revenue vs profit
economic vs economical
accept vs except
```

Contrast and misconception are therefore not optional decoration; they are fundamental inputs to DISCRIMINATE and STRENGTHEN.

---

## 15. A Context is a world with affordances

A Context cannot be modeled merely as:

```text
background
objects
coordinates
```

If the learner should be able to:

```text
identify
compare
move
choose a tool
follow a direction
predict
explain
```

the Context must model the relations that make those actions meaningful.

Candidate Context capabilities include:

```text
entities
roles
relations
states
events
constraints
affordances
goals
state transitions
```

Example:

```text
spoon:
role = utensil
affordance = scoop
relatedTo = soup

bowl:
role = container
affordance = contain
relatedTo = soup
```

Now the system can ask:

```text
You want to eat soup. What do you need?
```

instead of only:

```text
Which one is spoon?
```

---

## 16. Semantic interaction should be separate from renderer interaction

Do not bind learning actions directly to UI widgets.

Example semantic action:

```text
IDENTIFY_TARGET
```

Possible renderers:

```text
tap a card
tap an object in a scene
drag an item
move a character to the target
```

The learning meaning is the same.

Candidate semantic interactions include:

```text
SELECT
IDENTIFY
MATCH
CLASSIFY
ORDER
MOVE
CONNECT
COMPARE
PREDICT
CHANGE
OBSERVE
EXPLAIN
TYPE
DRAW
BUILD
PLACE
```

This separation is critical for reusing the same learning experience in different visual formats.

---

## 17. Candidate runtime architecture

The longer-term conceptual runtime is:

```text
Student State
        ↓
Cognitive Need
        ↓
Cognitive Mission
        ↓
Mission Requirements
        ↓
Capability Matching
        ↓
Knowledge + Context + Support
        ↓
Semantic Interaction
        ↓
Renderer
        ↓
Student Action
        ↓
Evidence
        ↓
Student State
```

Important:

- Context does not decide what the learner needs.
- Renderer does not decide learning strategy.
- Renderer does not grade.
- Cognitive Mission does not grade.
- Learning Core remains learner-state authority.

---

## 18. Preserve the current WordRanger architecture

Current frozen lower pipeline should remain:

```text
PublicLearningTask
→ StudentAction
→ TaskEvaluator
→ LearningEvidence
→ StudentLexemeModel
```

The new layer should ideally compile contextual experiences into the existing protocol.

Conceptually:

```text
LearningNeed
        ↓
Contextual Experience Layer
        ↓
LearningExperiencePlan
        ↓
Task Sequence
        ↓
PublicLearningTask
        ↓
existing runtime
```

The project should **not** build a second independent learning engine.

---

## 19. Learning Experience Plan candidate

A contextual experience is not necessarily one task.

One mission may compile into several tasks.

Candidate shape:

```ts
interface LearningExperiencePlan {
  id: string;

  mode:
    | "PROBE"
    | "BUILD"
    | "STRENGTHEN"
    | "RETRIEVE";

  targets: ExperienceTarget[];

  context: ContextReference;

  steps: ExperienceStep[];

  supportPolicy: SupportPolicy;

  completionPolicy: ExperienceCompletionPolicy;
}
```

Possible step:

```ts
interface ExperienceStep {
  id: string;

  targetLexemeIds: string[];

  semanticAction:
    | "IDENTIFY"
    | "SELECT"
    | "MATCH"
    | "DISTINGUISH"
    | "RECALL"
    | "TYPE"
    | "PLACE";

  taskRef?: string;
}
```

Example BUILD experience for `spoon`:

```text
1. identify a tool needed for soup
2. bind spoon to the object
3. distinguish spoon vs fork
4. use spoon in another context
5. retrieve “spoon” from meaning/context
```

These are not five unrelated questions; they form one cognitive experience.

---

## 20. New-user flow

New users do not have enough evidence.

They should enter a **lightweight contextual probe**, not a 1600-question vocabulary exam.

Possible flow:

```text
new user
↓
sample multiple contexts
↓
observe recognition / recall / confusion / context use
↓
build initial learner profile
↓
continue normal targeted practice
```

The first probe should create a coarse estimate, not exhaustively test all 1600 words.

Assessment should be continuous:

> Every future interaction continues to improve the learner model.

---

## 21. Existing-user flow

Old users already have evidence.

The app should:

```text
load StudentLexemeModel
↓
identify weak / fading / uncertain areas
↓
select suitable contexts
↓
choose STRENGTHEN / RETRIEVE / BUILD where justified
↓
run contextual experience
↓
update evidence
```

The student should not see internal labels such as:

```text
WEAKNESS
STAGE_PROGRESS
RETENTION_STATE
BUILD
STRENGTHEN
```

They should simply experience:

> “Continue practicing the words that still need work.”

---

## 22. Vocabulary scope

The app should support a user target scope.

Example:

```text
Junior High 1600
Senior High vocabulary
textbook range
exam range
custom vocabulary set
```

For the current MVP:

```text
Vocabulary Scope = Junior High 1600
```

Probe, build, strengthen, and retrieve all operate inside that scope.

---

## 23. Existing WordRanger data remains valuable

Current assets such as:

```text
canonical vocabulary
POS
synonym
antonym
word_family
confusable
variant
```

remain useful.

Examples:

```text
confusable → DISCRIMINATE
word_family → CONNECT
antonym → CONTRAST
```

The migration should enrich and contextualize existing data, not discard it.

---

## 24. Provenance must remain explicit

Generated contextual content will include:

```text
explanations
contexts
examples
misconceptions
analogies
hints
```

These may come from:

```text
SOURCE
CURATED
EXTERNAL_REFERENCE
MODEL_GENERATED / INFERRED
```

Every content unit should retain provenance, confidence, and review status where appropriate.

Model-generated content must not silently become authoritative learning content.

---

## 25. MVP migration strategy

Do **not** migrate all 1600 words immediately.

The first goal is to prove the architecture.

### Phase A — Context Domain Schema

Define candidate data structures:

```text
LexemeSense
SupportBlock
SemanticSkeleton
ContextFrame / ContextVariant
ContextBinding
SemanticInteraction
LearningExperiencePlan
```

No UI required yet.

### Phase B — Pilot Content

Select approximately 50–70 lexemes.

Deliberately include different types:

```text
concrete nouns
actions
properties
abstract words
relation words
confusable words
```

Suggested pilot contexts:

#### 1. Meal / Eating
Validates concrete objects, actions, functions, relations.

Potential variants:

```text
Kitchen
Restaurant
Picnic
```

#### 2. School Challenge / Competition
Validates abstract concepts.

Potential vocabulary:

```text
ability
success
possible
try
difficult
improve
```

#### 3. Borrowing / Sharing
Validates social relation and confusion.

Potential vocabulary:

```text
borrow
lend
give
take
return
accept
refuse
```

Each semantic skeleton should be tested in multiple context variants.

If changing Kitchen → Restaurant requires rewriting the knowledge model, the abstraction is wrong.

### Phase C — Cognitive Mission Protocol

Define deterministic candidate mappings for:

```text
PROBE
BUILD
STRENGTHEN
RETRIEVE
```

Do not rewrite Learning Core.

Examples:

```text
no evidence
→ PROBE

recognition success + active recall weakness
→ STRENGTHEN

stable repeated retrieval
→ RETRIEVE

repeated failures across multiple skills
→ BUILD candidate
```

Important:

```text
UNSEEN ≠ BUILD
```

### Phase D — Experience Planner

Input:

```text
LearningNeed
StudentLexemeModel
Context capability
Knowledge data
Support data
```

Output:

```text
LearningExperiencePlan
```

Start deterministic.

Do not require an LLM at runtime for MVP planning.

### Phase E — Context Renderer Pilot

Create one new internal pilot experience.

Possible route:

```text
/play/context-lab
```

Support a minimal interaction set:

```text
IDENTIFY
DISTINGUISH
RECALL
TYPE
```

Support a minimal support ladder and optional extension panel.

Do not redesign all four existing games.

### Phase F — Evidence Integration

Compile each experience step into existing:

```text
PublicLearningTask
→ StudentAction
→ TaskEvaluator
→ LearningEvidence
```

Validate:

```text
experience
→ evidence
→ StudentLexemeModel
→ next experience changes appropriately
```

Only after this loop works should coverage expand toward all 1600 words.

---

## 26. Content-coverage strategy

Separate:

```text
Schema Coverage
```

from:

```text
Content Coverage
```

The schema should be capable of representing the full vocabulary set early.

Actual content should grow gradually.

Suggested progression:

```text
Phase A
50–70 lexemes
3 semantic skeletons
~9 context variants

Phase B
200–300 lexemes
~10 skeletons

Phase C
~800 lexemes
more event/conceptual contexts

Phase D
full 1600
```

Do not mass-generate 1600 contexts before the schema is proven.

---

## 27. Extension / “learn more”

During contextual practice, the default UI should provide only what is needed for the current cognitive action.

Optional deeper support should be learner-invoked.

Possible UI:

```text
更多了解
```

Drawer/sheet may include:

```text
simple explanation
example
contrast / misconception
```

Do not turn the main learning screen into a dictionary page.

---

## 28. UI implication

The future main product experience may eventually organize around **contexts**, not around renderer names.

Possible long-term product surface:

```text
Kitchen
School
On the Way
Sports Day
Supermarket
Rainy Day
...
```

Inside a context, different renderers may be used automatically.

For example:

```text
find object       → tap
relation matching → matching
movement          → ranger/snake-like
active recall     → typing
```

The learner should experience a continuous world, while the system chooses the interaction renderer.

This is a possible future direction, **not an MVP requirement**.

Existing Ranger / Bubble / Matching / Snake remain useful as validated renderer/runtime experiments.

---

## 29. Cross-domain direction

The current design may later contribute to a broader learning framework supporting vocabulary, physics, chemistry, etc.

However:

> Do not prematurely standardize a universal schema.

The common candidate concepts currently appear to be:

```text
LearningObject
LearnerState
CognitiveNeed
CognitiveMission
Context
Support
SemanticInteraction
StudentAction
Evidence
```

But WordRanger should validate its own contextual model first.

A future cross-domain framework should be extracted from real implementations, not imposed in advance.

---

## 30. Key architectural invariants

These should remain explicit:

```text
1. Existing Learning Core remains the learner-state source of truth.

2. Context does not decide what the learner needs.

3. Cognitive Mission does not decide grading.

4. Renderer does not decide learning strategy.

5. Renderer does not grade.

6. Contextual Experience should compile into existing Task /
   StudentAction / Evidence contracts wherever possible.

7. Knowledge structure is separate from context presentation.

8. Semantic interaction is separate from UI renderer.

9. One word may participate in multiple contexts.

10. Context must carry meaning, not decoration.

11. Support is available as data but shown according to cognitive need.

12. UNSEEN means unobserved, not unknown.
```

---

## 31. Evaluation questions for the pilot

Before promoting this architecture from Candidate to Standard, the pilot must answer:

### Data reuse
Can one semantic skeleton be reused across at least 3 context variants?

### Abstract vocabulary
Can abstract words such as `ability`, `success`, `possible` fit naturally without artificial physical scenes?

### Social/relational vocabulary
Can pairs such as `borrow/lend` be represented as relationship structure rather than translation pairs?

### Cognitive modes
Can the same context support PROBE, BUILD, STRENGTHEN, and RETRIEVE?

### Support
Can hints, explanations, contrasts, misconceptions, and extension content be delivered without turning the experience into a dictionary page?

### Evidence
Can every meaningful learner action still produce valid existing WordRanger Evidence?

### Student model
Does an experience actually change the next plan?

### UI
Does the learner feel they are using vocabulary to complete tasks rather than repeating words to memorize them?

---

## 32. Current recommendation

Do not continue expanding Ranger UI until the new contextual architecture candidate has been validated enough to know what the main product experience should become.

Recommended next work:

```text
Step 1
Formalize candidate domain schema.

Step 2
Select 50–70 pilot lexemes.

Step 3
Build the 3 semantic skeletons:
- Meal
- School Challenge
- Borrowing / Sharing

Step 4
Create 3 context variants for each skeleton.

Step 5
Define minimal PROBE / BUILD / STRENGTHEN / RETRIEVE missions.

Step 6
Review architecture before implementation.
```

---

## 33. One-sentence product definition

A current concise product definition is:

> **WordRanger first discovers what vocabulary memory the learner already has, then lets the learner use that memory in meaningful contexts; it strengthens weak connections, builds missing ones, and verifies that the word can later be independently retrieved and used.**

A shorter experience principle is:

> **Do not repeat words in order to memorize them; build and strengthen memory by using words to do meaningful things.**

---

## 34. Handoff for the next conversation

In a new conversation, start from this document and do **not** re-derive the whole idea.

Recommended next topic:

> **Define `Contextual Learning Domain Model Candidate V0` for WordRanger, using Meal / School Challenge / Borrowing-Sharing as the three validation cases.**

The first implementation should remain a candidate and must not modify frozen WordRanger learning semantics until the schema and pilot cases are reviewed.
