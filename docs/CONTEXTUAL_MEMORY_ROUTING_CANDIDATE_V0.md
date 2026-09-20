# Contextual Memory Routing & Scene Vocabulary Coverage Candidate V0

> Status: **Candidate / Experimental / Not a Standard**
>
> This document does not modify frozen WordRanger learning semantics.
> It does not integrate `/train`, the Scheduler, Daily Training, or a second learner model.

---

## 1. Goals

WordRanger’s bundled vocabulary (1,600 source entries; **1,638** canonical lexemes at the time of this Candidate) should eventually be able to enter one or more **human-reviewed** scenes.

This Candidate layer answers two questions without changing Core:

1. At the current learning moment, should a `LexemeSenseRef` be planned as **BUILD** or **STRENGTHEN** — or is the frozen signal insufficient (**UNRESOLVED**)?
2. How is every bundled lexeme counted as **assigned to a reviewed scene**, **not yet assigned**, or **sense-ambiguous**, so later batches can be curated without silent omission?

Invariants that stay true:

- Scene organization does not change a word’s frozen Core identity (`lexemeId` / `canonicalKey`).
- BUILD / STRENGTHEN are **experience-planning intents**, not learner-state, not mastery, not Evidence outcomes, and not frozen `VocabularySkill` values.
- The same sense can be routed to different intents at different times.
- Distinct senses of one lexeme may enter different scenes.
- The same `{lexemeId, senseId}` may belong to more than one scene.

---

## 2. Non-goals

This increment does **not**:

- finish semantic curation of the full vocabulary
- wire Candidate routing into `/train` or the production Scheduler
- change Scheduler thresholds, quotas, or generation
- add a frozen Evidence outcome
- extend School Challenge or Borrowing-Sharing UI
- claim curriculum coverage is complete
- auto-assign remaining lexemes by string similarity or LLM
- treat Candidate as a Standard

---

## 3. Frozen inputs inspected

Source of truth is the repository, not this prompt.

| Frozen surface | Actual contract |
| --- | --- |
| `LearningNeed.reason` | `"NEW_WORD" \| "WEAKNESS" \| "REVIEW_DUE" \| "STAGE_PROGRESS" \| "FADING" \| "USER_MARKED"` (`src/domain/learning/learning-need.ts`) |
| Need Generator `NEW_WORD` | Emitted when there is no model **or** `masteryStage === UNSEEN` (`NEW_WORD_UNSEEN`) |
| Work Contract on UNSEEN | Unobserved — **not** “the student does not know the word” |
| Weakness types | `MEANING`, `LISTENING`, `SPELLING`, `ACTIVE_RECALL`, `CONTEXT`, `SEMANTIC_RELATION`, `CONFUSION`, `SLOW_RESPONSE`, `HINT_DEPENDENCY`, `LONG_TERM_INSTABILITY`, `USER_MARKED` |
| `StudentLexemeModel` | Lexeme-level snapshot: stage, retention, skills, weaknesses, `nextReviewAt`, `evidenceCount` |
| `Lexeme` | `id` (UUID), `canonicalKey`, `lemma`, `meaningsZh[]` — **no sense identity** |
| Bundled vocabulary | `data/vocabulary/canonical/words-canonical.json` via `loadVocabularyDataset()` |
| Planner mode | Existing Candidate `CognitiveMode` already includes `BUILD` / `STRENGTHEN` |

Capability gap (not a Core change):

**`NEW_WORD` is not a reliable first-learn / BUILD signal.** It means “unseen / no model,” which the Work Contract forbids reading as “unknown word.” This Candidate must not infer BUILD from missing Evidence or missing `StudentLexemeModel`. The honest BUILD branch is `UNRESOLVED` with `MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL` (`INSUFFICIENT_FROZEN_SIGNAL_FOR_BUILD`).

No frozen field is added to close that gap.

---

## 4. Definitions

### BUILD

Candidate intent: plan an initial, retrievable situational memory structure for one `LexemeSenseRef`.

BUILD is **not** a frozen skill, Evidence outcome, mastery level, or learner-state field.

V0 cannot **derive** BUILD from frozen Need/Evidence. A RESOLVED BUILD decision may exist only as an **explicit, authored Candidate fixture** for planner injection. The router never invents that fixture from `NEW_WORD` or empty history.

### STRENGTHEN

Candidate intent: plan a reinforcement experience for a `LexemeSenseRef` that already has a frozen practice/review/weakness signal.

STRENGTHEN is **not** “correct answer upgrades state” and does not compute mastery.

### UNRESOLVED

Returned when frozen data is missing, unmapped, unknown, or contradictory. Fail closed. Never default to BUILD.

---

## 5. Invariants

1. Catalog `lexemeId` must be a UUID that exists in bundled vocabulary.
2. `senseId` must come from an explicit, versioned Candidate mapping. Lemma inference is forbidden.
3. Every scene member declares a structured semantic role from that scene’s role registry.
4. Scene membership and learner state are separate.
5. One lexeme/sense may belong to multiple scenes.
6. Unassigned bundled lexemes are counted as `UNASSIGNED`. They are not silently dropped.
7. Polysemous lexemes (`meaningsZh.length > 1`) without an explicit catalog sense mapping are counted as `AMBIGUOUS_SENSE`.
8. Every BUILD/STRENGTHEN decision carries reason + provenance.
9. Insufficient or conflicting frozen input returns `UNRESOLVED`.
10. This module does not write Evidence, learner snapshots, tasks, or Scheduler plans.

---

## 6. Decision table (frozen → Candidate)

Inputs are the public `LearningNeed` projection only (`reason`, `supportingReasons`, `weaknessFocus`, `lexemeId`) plus an already-mapped `LexemeSenseRef`. The router does not read `StudentLexemeModel`.

| Frozen input | Candidate decision | Provenance / gap |
| --- | --- | --- |
| `reason: "NEW_WORD"` and no conflicting strengthen signal | **UNRESOLVED** | `MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL` — UNSEEN ≠ first-learn |
| `reason: "REVIEW_DUE"` | **STRENGTHEN** | `FROZEN_REVIEW_DUE` |
| `reason: "WEAKNESS"` + `ACTIVE_RECALL` | **STRENGTHEN** | `FROZEN_WEAKNESS_ACTIVE_RECALL` |
| `reason: "WEAKNESS"` + `SPELLING` | **STRENGTHEN** | `FROZEN_WEAKNESS_SPELLING` |
| `reason: "WEAKNESS"` + `CONFUSION` | **STRENGTHEN** | `FROZEN_WEAKNESS_CONFUSION` |
| `reason: "WEAKNESS"` + `HINT_DEPENDENCY` | **STRENGTHEN** | `FROZEN_WEAKNESS_HINT_DEPENDENCY` |
| `reason: "WEAKNESS"` + other listed `WeaknessType` and focus present | **STRENGTHEN** | `FROZEN_WEAKNESS_OTHER` (existing-history weakness, not scored here) |
| `reason: "WEAKNESS"` without `weaknessFocus` | **UNRESOLVED** | `MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL` |
| `STAGE_PROGRESS` / `FADING` / `USER_MARKED` | **UNRESOLVED** | `MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL` — not in the V0 strengthen table |
| Unknown `reason` | **UNRESOLVED** | `MEMORY_ROUTING_UNKNOWN_NEED_REASON` |
| `NEW_WORD` together with `REVIEW_DUE` or `WEAKNESS` | **UNRESOLVED** | `MEMORY_ROUTING_CONFLICTING_SIGNALS` |
| Missing `senseId` / empty target | **UNRESOLVED** | `MEMORY_ROUTING_UNMAPPED_SENSE` |
| Need `lexemeId` ≠ target `lexemeId` | **UNRESOLVED** | `MEMORY_ROUTING_CONFLICTING_SIGNALS` |

No Candidate-invented numeric thresholds. No `hintCount` → new Evidence outcome.

---

## 7. Scene vocabulary catalog

A versioned Candidate catalog describes **only** fixture words that already appear in Meal / School Challenge / Borrowing-Sharing knowledge files, rebound onto **real bundled UUIDs**.

Identity is `{lexemeId, senseId}` plus `canonicalKey`. Lemma is display, never identity.

Coverage auditor (read-only, deterministic):

- `totalLexemes` comes from the loaded bundled dataset (not a hardcoded 1600).
- `assignedLexemes + unassignedLexemes = totalLexemes` (lexeme-id axis).
- `ambiguousSenseLexemes` is a **separate axis**: bundled lexemes with more than one `meaningsZh` and no explicit catalog sense mapping. It currently overlaps `unassigned`. Assigned members with an explicit `senseId` are not counted as ambiguous.
- Invalid catalog rows fail validation. `UNASSIGNED` does not fail the coverage script.

There is no official bundled vocabulary semver. Reports use Candidate provenance `candidate-v0-bundled-canonical`, not an invented Core version.

---

## 8. Planner integration

Existing `planExperience` already requires an externally supplied `CognitiveMode`. This increment does **not** add a second intent enum.

Legal path:

```text
routeContextualMemory(frozen need projection + mapped sense)
  → if UNRESOLVED: fail closed (do not call planner as BUILD)
  → if RESOLVED: planningModeFromRoutingDecision → planExperience({ mode: intent, memoryRoutingDecision })
```

- Planner must not re-read a learner snapshot to pick BUILD/STRENGTHEN.
- If `memoryRoutingDecision` is omitted, today’s Meal Context Lab / planner happy path is unchanged.
- If it is present and `UNRESOLVED`, planning fails closed (`PLAN_MEMORY_ROUTING_UNRESOLVED`).
- If it is present and RESOLVED, `input.mode` must already equal `decision.intent`.

`/train` and the production Scheduler are not wired.

---

## 9. Three-case pilot

Only fixture lemmas that exist in bundled vocabulary are registered. All current Meal / School / Borrow fixture lemmas **do** exist; lemma is unique in this dataset, but **671** lexemes are polysemous, so sense mapping remains explicit Candidate content.

- **Meal** — tool / food / container / drink / action roles. Spoon UUID matches Context Lab handoff (`lex-1311-1`).
- **School Challenge** — capacity property, reachability, difficulty, attempt, strategy, and outcome are separate roles. `has_general_ability` is not reintroduced.
- **Borrowing-Sharing** — `borrow` and `lend` keep requester vs owner perspective. Clusters do not flatten direction.

---

## 10. Stop / gap codes

| Code | Meaning |
| --- | --- |
| `INSUFFICIENT_FROZEN_SIGNAL_FOR_BUILD` | Frozen contract has no honest first-learn → BUILD signal |
| `SENSE_MAPPING_REQUIRES_CONTENT_REVIEW` | Polysemy without an explicit Candidate sense |
| `FIXTURE_LEXEME_NOT_IN_BUNDLED_VOCABULARY` | Would apply if a fixture lemma were missing (none are, in this increment) |
| `FROZEN_CONTRACT_CHANGE_REQUIRED` | Would apply if routing needed a new `LearningNeed` field (not done) |
