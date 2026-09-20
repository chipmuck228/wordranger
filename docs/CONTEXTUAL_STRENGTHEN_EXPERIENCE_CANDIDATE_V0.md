# Contextual STRENGTHEN Experience Candidate V0

> Status: **Candidate / Experimental / Not a Standard**
>
> The spoon-only active-recall STRENGTHEN pilot is now a Meal four-target
> Candidate: soup, bowl, spoon, and fork. Generation is catalog/profile
> driven. It does not change frozen WordRanger learning semantics and is
> not wired into `/train`.

See `docs/CONTEXTUAL_SUPPORT_PRESENTATION_CANDIDATE_V0.md` for support presentation rules. This file only adds the experience sequence.

## Scope

This increment covers the four current Meal Probe scene targets. It does
not represent the full Meal vocabulary, does not generate 1,638 scene
words, and does not make Candidate a Standard.

## Trigger

Server-recomputed Probe routing must show, for a specific bundled target:

```text
disposition = STRENGTHEN
exactly one ACTIVE_RECALL observation that is not independently correct
exactly one MEANING_RECOGNITION observation that is a held success
both observations share that same lexemeId + senseId
task IDs are nonempty and distinct
```

Unknown or future Evidence outcomes fail closed. READY, BUILD, and
UNRESOLVED do not enter the STRENGTHEN queue. Non-spoon BUILD remains an
explicit capability gap and is never rewritten as STRENGTHEN.

The browser submits only `{ runId, revision, intent? }`.
`intent` is `START_BUILD` or `START_STRENGTHEN`. The client cannot submit
a target ID, index, or queue.

## Sequence

Each queued target uses the same authored sequence:

```text
Reconnect form (guided support)
  → Fade form (guided support)
  → Frozen ACTIVE_RECALL_TYPING verification
  → existing submitTaskAction / evaluator / Evidence
```

Reconnect and fade do not produce Evidence. Verification uses the real
bundled UUID for the current target and the Ranger Trial text-input
renderer identity.

## Server-authoritative queue

If several Probe results are eligible, the server rebuilds a deterministic
queue from Probe observations in Meal scene order. Only one current
target experience is issued. Completing a target lets the server decide
whether to issue the next one. Refresh restores the current target and
step. Assisted verification is not long-term independent retrieval.

## Frozen hintCount

Persisted Candidate support exposures (`LEXICAL_FORM` or `SPELLING_CUE`)
map to frozen `hintCount > 0` only when they belong to the current
target and current strengthen plan, and were shown before verification.

Frozen `ASSISTED_CORRECT` therefore means: this verification happened
after support exposure. It is not independent mastery, not a new
Candidate outcome, and not proof of later unaided recall.
