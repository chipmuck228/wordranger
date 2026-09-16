# Architecture Decisions

## ADR-001 — Game does not own learning state

**Status:** accepted

Games may only produce `LearningEvidence`. Mastery, retention, weaknesses, and review times are written exclusively by the Learning Engine. This keeps every future game on the same rules and prevents “the snake game thinks this word is mastered”.

## ADR-002 — Evidence is source of truth

**Status:** accepted

`learning_evidence` is an append-only log of immutable facts. `StudentLexemeModel` is a snapshot. Policy v2 should replay evidence rather than migrate guessed state.

## ADR-003 — Mastery / Retention / Weakness are separate dimensions

**Status:** accepted

A mastered lexeme can still fade and still have a spelling hole. Collapsing those into one enum would force false demotions (one typo dropping `MASTERED` to `RECALLED`) or hide actionable weaknesses.

## ADR-004 — Learning algorithm is policy-driven

**Status:** accepted

Thresholds such as `0.70`, `2 sessions`, and `7 days` live in `LearningPolicy`, not in engine `if` statements. Tests pin behavior to `DEFAULT_LEARNING_POLICY` v1.

## ADR-005 — Learning core is game-agnostic

**Status:** accepted

The core knows skills, prompt modes, and answer modes. It does not import `SnakeGame` or branch on a game title. Games publish `GameCapability`; a future Scheduler matches `LearningNeed` to those capabilities.

## ADR-006 — Event + Snapshot persistence model

**Status:** accepted

Evidence is always stored. The snapshot is stored for cheap reads. In-memory commits are atomic. Supabase V1 writes evidence then snapshot; snapshot failure is rebuildable. A database RPC is the intended later atomic boundary.

## ADR-007 — V1 uses a deterministic rule engine instead of ML/LLM

**Status:** accepted

Junior-high vocabulary practice needs explanations a teacher can inspect: why a lexeme upgraded, why it is fading, why spelling is tagged. V1 therefore uses EWMA scores, explicit stage gates, and rule-based weakness detection. No LLM judge and no Bayesian tracker in this phase.

## ADR-008 — Student learning state attaches to Lexeme, not SourceEntry

**Status:** accepted

A PDF numbered line such as `19 actor / actress` is one `VocabularySourceEntry` and two independently trainable `Lexeme`s. `StudentLexemeModel`, `LearningEvidence`, `Weakness`, and `LearningNeed` bind to `lexemeId`. Binding to source entries would make split lemmas share one mastery score.

## ADR-009 — Vocabulary source / canonical / enrichment are separate layers

**Status:** accepted

Source JSON preserves PDF facts, including errors. Canonical lexemes may correct meaning or split entries. Enrichment (relations, tags) is optional and confidence-scored. Import must not write canonical corrections back into source rows.

## ADR-010 — Relation confidence / provenance controls production usability

**Status:** accepted

`source_structural` is a structural fact. `curated_model` is conservative enrichment. `rule_inferred` is a candidate, not a learning fact. Production `VocabularyRepository.getRelations()` applies `VocabularyContentPolicy` (`source_structural >= 0.95`, `curated_model >= 0.80`, `rule_inferred` disabled). The numeric floors live only in that policy object.

## ADR-011 — wordId renamed to lexemeId

**Status:** accepted

Phase 01 used `wordId` against a placeholder `words` table. Phase 02 performs a clean rename across domain types, repositories, Debug Lab, and SQL (`lexeme_id`, `student_lexeme_models`). Dual fields are not kept.

## ADR-012 — Evidence CORRECT removed to eliminate ambiguous success semantics

**Status:** accepted

`CORRECT` plus `hintCount === 0` was also treated as independent success, overlapping `INDEPENDENT_CORRECT`. V1 outcomes are `INDEPENDENT_CORRECT`, `ASSISTED_CORRECT`, `INCORRECT`, `SKIPPED`, `TIMEOUT`. Independent success with hints, or assisted success with zero hints, is rejected at the evidence boundary.

## ADR-013 — Student snapshot records policyVersion

**Status:** accepted

Each `StudentLexemeModel` stores `policyVersion` from the `LearningPolicy` used by `processEvidence`. This makes it obvious which rule set produced the snapshot when a future policy v2 replays evidence.

## Additional notes

- The `LearningRepository` and `VocabularyRepository` *interfaces* live in domain so engines do not import Supabase. Server files implement the ports.
- `LearningPolicy` includes a `confidence` section so confidence math is also policy-driven.
- Vitest 3 is used instead of Vitest 5 because Vitest 5 pulled a broken rolldown native binding in this environment.
- Extra engine helpers (`math.ts`, `time.ts`, `evidence-helpers.ts`, `validate-evidence.ts`) keep the named engine files focused and pure.
- The Debug Lab form uses native `<select>` for dense enum fields, plus shadcn Button/Card/Input/Label/Badge.
- Import IDs are deterministic UUID v5-style values derived from canonical keys, so re-import matches existing rows.
