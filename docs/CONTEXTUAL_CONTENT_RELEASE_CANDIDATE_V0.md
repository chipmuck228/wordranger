# Contextual Content Release Pipeline — Candidate V0

**Status: Candidate / Experimental / Not a Standard.**

This document defines Phase 1 of an experimental content release pipeline. It is not a project standard, is not wired into production Daily Training, and does not publish or activate a runtime.

Phase 1 implements only:

```text
DRAFT → PREFLIGHT_VALIDATED
```

It does **not** implement `PUBLISHED`, activate an experimental release, or change the current six-word Context Lab.

## 1. Release lifecycle

Candidate V0 statuses:

| Status | Meaning | This phase |
| --- | --- | --- |
| `DRAFT` | Server-built immutable snapshot waiting for preflight | Implemented |
| `PREFLIGHT_VALIDATED` | Server re-read authority sources and the snapshot still matches | Implemented |
| `PUBLISHED` | Future atomic publication of this exact snapshot into experimental runtime | Designed only |
| `SUPERSEDED` | Future: a newer published release replaced this one | Designed only |
| `ROLLED_BACK` | Future: active pointer moved off this release onto an older immutable release | Designed only |

Explicit non-equivalences:

- Human approval is not publication.
- Validation is not publication.
- Publication is not Standard.
- Publication, when it exists, targets experimental runtime only.
- `/train` does not read this release.

A validated dry-run must never be labeled published.

## 2. Immutable release identity

```ts
ContextualContentReleaseManifest {
  schemaVersion
  kind
  releaseId
  sceneId
  baseReleaseId
  status
  revision
  targetEntries
  packSnapshot
  contextSnapshot
  packFingerprint
  contextModelFingerprint
  releaseFingerprint
  createdAt
  createdBy
  validatedAt
  validationSummary
}
```

Each `targetEntry` binds at least:

- `reviewKey`
- `packId`
- `LexemeSenseRef`
- `contentFingerprint`
- `reviewRevision`
- `humanDecision`
- selected meaning
- source refs
- `approvalBasis`

`createdBy` is stamped by the server. Clients never submit `userId`.

## 3. Snapshot semantics

A Release Manifest must contain or reference an immutable snapshot. It must not say “use whatever the live registry currently has.”

If a later author edit changes a pack, frame, or skeleton, a previously validated release must keep the snapshotted bytes and fail a new preflight with drift.

Distinguish:

| Object | Meaning |
| --- | --- |
| Authored Candidate | Current pack in the Candidate registry |
| Approved review snapshot | Human review record bound to a content fingerprint and revision |
| Release snapshot | Frozen pack + frames + skeleton + review bindings copied into a manifest |
| Active experimental release | Future pointer to one published immutable release. **Does not exist in Phase 1.** |

The current Context Lab remains code-defined six-word batch 02. It is not selected by a release pointer.

## 4. Fingerprints

| Fingerprint | Covers |
| --- | --- |
| Target content fingerprint | One lexeme in one pack, including source refs and meaning selector |
| Authored pack fingerprint | Entire snapshotted pack |
| Context model fingerprint | Snapshotted frames and skeleton |
| Complete release fingerprint | Targets, target order, pack, frames, skeleton, source refs, review bindings, base release |

The release fingerprint is deterministic. Changing target order, pack content, frames, skeleton, review bindings, or base release must change it.

### Approval-chain invariant

Every release target must bind through exactly one chain. Presence in the current pack is not approval.

**A. `LEGACY_EXPERIMENT_BASELINE`**

- Target content fingerprint against the grandfathered four-word baseline pack equals the current snapshot target fingerprint computed against that same baseline pack id and source refs.
- The baseline pack id and pack fingerprint are the immutable `MEAL_LEGACY_EXPERIMENT_BASELINE`.
- `ReleaseTargetEntry.contentFingerprint` is that grandfathered target fingerprint, not a newly generated current-pack fingerprint.

**B. `HUMAN_REVIEW_PROMOTION`**

```text
reviewedPackTargetFingerprint
=== committedReviewRecord.contentFingerprint
=== currentReleaseSnapshotTargetFingerprint
```

The current snapshot lexeme is fingerprinted with the reviewed pack's id and source refs so pack-wrapper identity cannot hide authored-content drift. Same `LexemeSenseRef` is not content equality.

If the historical review is still valid but the current snapshot target changed, authority fails with `RELEASE_REVIEW_STALE` / `RELEASE_FINGERPRINT_DRIFT`. The current snapshot fingerprint is never rewritten as the approved fingerprint.

## 5. Atomicity / CAS

- `revision` is the optimistic concurrency token.
- Writers send `expectedRevision` only. They do not send fingerprints, pack JSON, or desired status.
- Idempotent retry of the same successful request returns the same stored result.
- Concurrent same-revision writes: one succeeds, the others are stale/conflict.
- Future publication CAS and future active-pointer CAS are designed, not implemented.

## 6. Rollback semantics

Phase 1 designs rollback and does not execute it.

Rollback means: move the future active pointer to an older immutable release.

Rollback does **not**:

- delete Evidence
- delete historical releases
- rewrite an old manifest
- roll back learner state

## 7. Authority and client contract

The browser may submit only:

```ts
{ releaseId, revision }
```

or ask the server to create the migration draft with no client-chosen identity payload.

The browser must not submit:

- target fingerprint
- review decision
- review revision
- pack JSON
- frame / skeleton
- source path
- userId
- desired status
- active pointer

The server reads:

- review target registry
- committed / current review records
- Candidate pack registry
- bundled vocabulary
- frames / skeleton
- current experimental pack

## 8. Phase 1 demonstration

`meal-release-migration-v0` is a dry-run snapshot of the current six-word Meal pack:

`soup`, `bowl`, `spoon`, `fork`, `cup`, `plate`

- cup and plate bind real human review records
- the original four words use explicit `LEGACY_EXPERIMENT_BASELINE` attestation
- no forged four-word human reviews
- no runtime switch
- no registry mutation
- no new Evidence
- no claim that a publisher published this pack

## 9. Runtime policy

`CONTEXTUAL_RELEASE_RUNTIME` is independent of `CONTEXT_LAB_RUNTIME` and `GAME_RUNTIME`.

| Value | Allowed |
| --- | --- |
| unset / illegal | Fail closed |
| `memory` | Local / e2e only |
| `file` | Local development only |
| `supabase` | Future; this phase ships interface + migration proposal only |

Vercel preview / production must not write memory or file adapters. There is no silent fallback.

## 10. Debug tool

Route: `/debug/contextual-content-release`

Flags:

- `CONTEXTUAL_CONTENT_RELEASE_ENABLED`
- `CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED`

Allowed actions: create migration Draft, run Preflight, refresh, discard local Draft.

Forbidden actions: Publish, Activate, Rollback, Promote to Standard, write `/train`.

The page must state that this phase only validates a release snapshot and does not switch Context Lab.
