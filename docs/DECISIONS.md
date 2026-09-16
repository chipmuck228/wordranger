# Architecture Decisions

## ADR-001 — Game does not own learning state

**Status:** accepted

Games may only produce `LearningEvidence`. Mastery, retention, weaknesses, and review times are written exclusively by the Learning Engine. This keeps every future game on the same rules and prevents “the snake game thinks this word is mastered”.

## ADR-002 — Evidence is source of truth

**Status:** accepted

`learning_evidence` is an append-only log of immutable facts. `StudentWordModel` is a snapshot. Policy v2 should replay evidence rather than migrate guessed state.

## ADR-003 — Mastery / Retention / Weakness are separate dimensions

**Status:** accepted

A mastered word can still fade and still have a spelling hole. Collapsing those into one enum would force false demotions (one typo dropping `MASTERED` to `RECALLED`) or hide actionable weaknesses.

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

Junior-high vocabulary practice needs explanations a teacher can inspect: why a word upgraded, why it is fading, why spelling is tagged. V1 therefore uses EWMA scores, explicit stage gates, and rule-based weakness detection. No LLM judge and no Bayesian tracker in this phase.

## Additional notes

- The `LearningRepository` *interface* lives in `src/domain/learning` so the engine does not import Supabase. `src/server/learning/learning-repository.ts` re-exports it. Server files implement the port.
- `LearningPolicy` includes a `confidence` section so confidence math is also policy-driven.
- Vitest 3 is used instead of Vitest 5 because Vitest 5 pulled a broken rolldown native binding in this environment.
- Extra engine helpers (`math.ts`, `time.ts`, `evidence-helpers.ts`, `validate-evidence.ts`) keep the named engine files focused and pure.
- The Debug Lab form uses native `<select>` for dense enum fields, plus shadcn Button/Card/Input/Label/Badge.
