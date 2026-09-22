# Contextual Content Release Pipeline — Candidate V0

**Status: Candidate / Experimental / Not a Standard.**

This document defines Phase 2 of an experimental content release pipeline. It is not a project standard, is not wired into production Daily Training, and does not change frozen WordRanger learning semantics.

Phase 2 implements:

```text
DRAFT → PREFLIGHT_VALIDATED → PUBLISHED + ACTIVE pointer
```

`ACTIVE` is an independent pointer, not a release manifest status.

## 1. Release lifecycle

Candidate V0 statuses:

| Status | Meaning |
| --- | --- |
| `DRAFT` | Server-built immutable snapshot waiting for preflight |
| `PREFLIGHT_VALIDATED` | Server re-read authority sources and the snapshot still matches |
| `PUBLISHED` | Immutable published snapshot. May or may not be the current active pointer. |
| `SUPERSEDED` | A newer publish replaced this snapshot as the previous active release |
| `ROLLED_BACK` | Not used as a write status. Rollback only moves the active pointer. |

Explicit non-equivalences:

- Human approval is not publication.
- Validation is not publication.
- Publication is not Standard.
- Publication targets experimental Context Lab only.
- `/train` does not read this release.
- Publish is not learner completion and does not write Evidence.

Allowed lifecycle metadata after publish:

- `publishedAt` / `publishedBy`
- `supersededAt` / `supersededByReleaseId`

Snapshot content, fingerprints, review bindings, and creation metadata stay immutable.

## 2. Active pointer

```ts
ContextualContentActiveReleasePointer {
  schemaVersion
  kind
  sceneId
  releaseId
  releaseFingerprint
  revision
  activatedAt
  activatedBy
}
```

Rules:

- One pointer per scene
- Pointer binds both `releaseId` and `releaseFingerprint`
- Updates use pointer revision / CAS
- Load fail-closes unless the pointed release exists, `status === PUBLISHED`, scene matches, fingerprints recompute, and pointer fingerprint matches
- Never silently pick the latest row

## 3. Atomic publish

Publish accepts only `{ releaseId, revision }` from the client.

The server re-runs readiness checks, then atomically:

1. `PREFLIGHT_VALIDATED` → `PUBLISHED`
2. Updates the scene pointer
3. Marks the previous active release `SUPERSEDED`

Memory uses a mutex queue. Supabase uses a single RPC/transaction. File uses the same in-process queue.

## 4. Rollback

`rollbackContextualContentActiveRelease({ sceneId, expectedPointerRevision, targetReleaseId })`

- Target must have been successfully published
- Scene, fingerprints, and approval chain must still verify
- Pointer CAS only
- Current and historical releases are not deleted
- Learner data is not modified

## 5. Context Lab content source

`CONTEXT_LAB_CONTENT_SOURCE=static|active-release`

| Value | Behavior |
| --- | --- |
| unset / `static` | Current six-word experimental pack. Does not read the pointer. |
| `active-release` | Loads only the server active published snapshot. No silent static fallback. |

ExperienceRun pins `releaseId` + `releaseFingerprint` at creation. Later requests keep that pin even if a newer release becomes active.

## 6. Debug tool

Route: `/debug/contextual-content-release`

Flags:

- `CONTEXTUAL_CONTENT_RELEASE_ENABLED`
- `CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED`

Allowed actions: create Draft, Preflight, Publish, pointer rollback, refresh, discard local Draft.

The page must state that this is Experimental Context Lab content publishing and does not publish to `/train`.
