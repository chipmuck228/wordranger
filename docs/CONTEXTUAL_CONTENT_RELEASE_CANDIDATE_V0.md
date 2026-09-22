# Contextual Content Release Pipeline — Candidate V0

**Status: Candidate / Experimental / Not a Standard.**

This document defines Phase 2 of an experimental content release pipeline. It is not a project standard, is not wired into production Daily Training, and does not change frozen WordRanger learning semantics.

Phase 2 implements:

```text
DRAFT → PREFLIGHT_VALIDATED → PUBLISHED + ACTIVE pointer
```

`ACTIVE` is an independent pointer, not a release manifest status. UI must never treat `status === PUBLISHED` as ACTIVE.

## 1. Release lifecycle

Candidate V0 statuses:

| Status | Meaning |
| --- | --- |
| `DRAFT` | Server-built immutable snapshot waiting for preflight |
| `PREFLIGHT_VALIDATED` | Server re-read authority sources and the snapshot still matches |
| `PUBLISHED` | Immutable published snapshot. May or may not be the current active pointer. |
| `SUPERSEDED` | This snapshot is no longer the active pointer, because a later publish or rollback replaced it. |
| `ROLLED_BACK` | Not used as a write status. Rollback only moves the active pointer. |

Explicit non-equivalences:

- Human approval is not publication.
- Validation is not publication.
- Publication is not Standard.
- Publication targets experimental Context Lab only.
- `/train` does not read this release.
- Publish is not learner completion and does not write Evidence.
- `PUBLISHED` is not `ACTIVE`. Active is only the scene pointer.

Allowed lifecycle metadata after publish:

- `publishedAt` / `publishedBy`
- `supersededAt` / `supersededByReleaseId`

Snapshot content, fingerprints, review bindings, historical approval bindings, and creation metadata stay immutable.

## 1.1 Persistence consistency

`contextual_content_releases` stores one full domain snapshot in `manifest` and constrained index/CAS copies in row columns.

After every committed write, all adapters (Supabase, Memory, File) must expose the same observables:

- `row.release_id = manifest.releaseId`
- `row.scene_id = manifest.sceneId`
- `row.status = manifest.status`
- `row.revision = manifest.revision`
- `row.schema_version = manifest.schemaVersion`
- `row.published_at = manifest.publishedAt`
- `row.published_by = manifest.publishedBy`
- `row.superseded_at = manifest.supersededAt`
- `row.superseded_by_release_id = manifest.supersededByReleaseId`

Fact source:

- Manifest is the complete domain snapshot.
- Row columns are constrained index copies, not a second source of truth.
- Write transactions construct the final `manifest.status` / `manifest.revision` (and lifecycle timestamps) themselves. Callers may send a PUBLISHED intent manifest, but adapters must not persist a caller JSON whose revision/status disagrees with the committed row.
- Reads fail closed on row/manifest mismatch. They do not repair one side from the other.

Supabase enforces the same check in `contextual_content_releases_row_manifest_parity`.

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

The server runs `evaluatePublishReadiness` against the current authoring authority, then atomically:

1. `PREFLIGHT_VALIDATED` → `PUBLISHED` with `revision = previous + 1`
2. Updates the scene pointer to the published fingerprint
3. Marks the previous active release `SUPERSEDED` with `revision = previous + 1`

The database (or Memory/File queue) constructs the final published and superseded manifests from the stored snapshot. It does not trust a caller JSON whose identity disagrees with the locked row.

Memory uses a mutex queue. Supabase uses a single RPC/transaction. File uses the same in-process queue.

## 4. Rollback

`rollbackContextualContentActiveRelease({ sceneId, expectedPointerRevision, targetReleaseId })`

Model after rolling B back to A:

- Pointer points at A
- `A.status = PUBLISHED`, `A.revision = previous + 1`
- `A.supersededAt` and `A.supersededByReleaseId` are cleared because A is no longer superseded
- `B.status = SUPERSEDED`, `B.revision = previous + 1`
- `B.supersededAt` / `B.supersededByReleaseId = A` records that B stopped being active because A was restored
- B is not deleted
- `loadActiveRelease` must immediately return A

Rules:

- Target must have been successfully published (`PUBLISHED` or `SUPERSEDED` plus `publishedAt`)
- Historical integrity uses `evaluateHistoricalReleaseIntegrity`, not live-pack publish readiness
- Scene, fingerprints, and the release's own frozen approval bindings must still verify
- Pointer CAS only
- Current and historical releases are not deleted
- Learner data is not modified

## 4.1 Publish readiness vs historical integrity

`evaluatePublishReadiness` is for first publish / preflight. It requires the snapshot to match the current authoring authority, current review decisions, current pack/context, approval chain, capabilities, fingerprints, and to contain no learner data.

`evaluateHistoricalReleaseIntegrity` is for rollback of a previously published snapshot. It verifies:

- the release was really published
- schema, fingerprints, pack/context/targetEntries are self-consistent
- frozen `historicalApprovalBindings` exist and match the snapshot
- runtime capabilities can still execute that snapshot
- no AnswerKey / Evidence / learner state / `/train`

Historical rollback must not require `historicalRelease === currentLiveAuthoringPack`. Missing frozen approval bindings is a hard reject. Status `SUPERSEDED` alone is not enough.

Do not rewrite stored human review records to invent a historical approval source.

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

The page must state that this is Experimental Context Lab content publishing and does not publish to `/train`. ACTIVE is shown only from the pointer, never inferred from `PUBLISHED`.
