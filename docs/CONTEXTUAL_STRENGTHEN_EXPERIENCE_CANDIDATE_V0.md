# Contextual STRENGTHEN Experience Candidate V0

> Status: **Candidate / Experimental / Not a Standard**
>
> This document records the Meal spoon active-recall STRENGTHEN happy path.
> It does not change frozen WordRanger learning semantics and is not wired into `/train`.

See `docs/CONTEXTUAL_SUPPORT_PRESENTATION_CANDIDATE_V0.md` for support presentation rules. This file only adds the experience sequence.

## Trigger

Server-recomputed Probe routing must show:

```text
target = bundled spoon UUID
disposition = STRENGTHEN
ACTIVE_RECALL exists and is not INDEPENDENT_CORRECT
MEANING_RECOGNITION exists and is INDEPENDENT_CORRECT or ASSISTED_CORRECT
```

The browser submits only `{ runId, revision }`. READY, BUILD, UNRESOLVED, and non-spoon STRENGTHEN do not enter this path.

## Sequence

```text
Reconnect form (guided support)
  → Fade form (guided support)
  → Frozen ACTIVE_RECALL_TYPING verification
  → existing submitTaskAction / evaluator / Evidence
```

Reconnect and fade do not produce Evidence. Verification uses the real spoon UUID and Ranger Trial text-input renderer identity.

## Frozen hintCount

Persisted Candidate support exposures (`LEXICAL_FORM` or `SPELLING_CUE`) map to frozen `hintCount > 0`.

Frozen `ASSISTED_CORRECT` therefore means: this verification happened after support exposure. It is not independent mastery, not a new Candidate outcome, and not proof of later unaided recall.
