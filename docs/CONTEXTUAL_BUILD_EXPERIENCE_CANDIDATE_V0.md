# Contextual BUILD Experience Candidate V0

> Status: **Candidate / Experimental / Not a Standard**
>
> Meal Probe can now queue BUILD for soup, bowl, spoon, and fork. Generation
> is catalog/profile driven. It does not change frozen WordRanger learning
> semantics and is not wired into `/train`.

See `docs/CONTEXTUAL_SUPPORT_PRESENTATION_CANDIDATE_V0.md` for support
presentation rules. This file only adds the BUILD experience sequence.

## Scope

This increment covers the four current Meal Probe scene targets. It does
not represent the full Meal vocabulary, does not generate 1,638 scene
words, and does not make Candidate a Standard.

Probe is a pre-teaching check:

| Disposition | Meaning |
| --- | --- |
| READY | Independent recall held. No teaching now. |
| STRENGTHEN | Meaning was recognized; form recall needs repair. |
| BUILD | Recall and recognition both failed. A scene–meaning–form connection still needs to be established. |
| UNRESOLVED | Observations are incomplete or conflicting. Do not invent teaching. |

BUILD and STRENGTHEN are different experiences. BUILD establishes a new
scene–meaning–form connection. STRENGTHEN repairs an existing
meaning-to-form retrieval connection.

## Trigger

Server-recomputed Probe routing must show, for a specific bundled target:

```text
disposition = BUILD
exactly one ACTIVE_RECALL observation that is not independently correct
exactly one MEANING_RECOGNITION observation that is not a held success
both observations share that same lexemeId + senseId
task IDs are nonempty and distinct
```

If the stored disposition string disagrees with the observations, queue
creation fails closed. READY, STRENGTHEN, and UNRESOLVED do not enter
the BUILD queue.

The browser submits only `{ runId, revision, intent? }`.
`intent` is `START_BUILD` or `START_STRENGTHEN`. The client cannot submit
a target ID, index, or queue.

## Sequence

Each queued target uses the same authored sequence:

```text
Ground context (guided)
  → Connect entity and meaning (guided)
  → Present lexical form (guided teaching support)
  → Contrast or discriminate (guided)
  → Fade support (guided)
  → Frozen ACTIVE_RECALL_TYPING verification
  → existing submitTaskAction / evaluator / Evidence
```

Guided acknowledgements do not produce Evidence. Final recall uses the
real bundled UUID for the current target and the Ranger Trial text-input
renderer identity.

## Server-authoritative queue

If several Probe results are eligible, the server rebuilds a deterministic
queue from Probe observations in Meal scene order. Only one current
target experience is issued. Completing a target lets the server decide
whether to issue the next one. Refresh restores the current target and
step.

BUILD and STRENGTHEN queues are independent. Completing one does not
start the other. The other operation can still be reloaded from the
Probe summary after the server revalidates eligibility.

The queue is Candidate orchestration, not the Scheduler.

## Frozen hintCount

Meal BUILD final recall keeps frozen `hintCount = 0`. Guided teaching
exposure is Candidate orchestration context. Frozen `hintCount` still
only expresses support that belongs to the frozen task contract. That is
not a complete model of contextual support history. It is a recorded
capability/semantic gap, not a new Evidence outcome.

## Remaining gaps

- This is a Meal fixture, not production `/train`.
- This is not a Scheduler.
- This is not complete 1600-word coverage.
- This is not a new frozen learning standard.
