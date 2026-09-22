import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  parseActiveReleasePointer,
  parseReleaseManifest,
  type ContextualContentActiveReleasePointer,
  type ContextualContentReleaseManifest,
} from "@/contextual-learning/candidate-v0/release";
import type { ReleaseFailureCode } from "./types";

export function rejectPublishIdentity(input: {
  stored: ContextualContentReleaseManifest;
  incoming: ContextualContentReleaseManifest;
  pointer: ContextualContentActiveReleasePointer;
}): { ok: false; code: ReleaseFailureCode; message: string } | null {
  if (
    input.incoming.releaseId !== input.stored.releaseId ||
    input.incoming.sceneId !== input.stored.sceneId ||
    input.incoming.schemaVersion !== input.stored.schemaVersion ||
    input.incoming.releaseFingerprint !== input.stored.releaseFingerprint ||
    input.incoming.packFingerprint !== input.stored.packFingerprint ||
    input.incoming.contextModelFingerprint !== input.stored.contextModelFingerprint
  ) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: "Published manifest identity does not match the stored release.",
    };
  }
  if (input.incoming.status !== "PUBLISHED") {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: "Publish atom requires a PUBLISHED intent manifest.",
    };
  }
  if (
    input.pointer.releaseId !== input.stored.releaseId ||
    input.pointer.sceneId !== input.stored.sceneId ||
    input.pointer.releaseFingerprint !== input.stored.releaseFingerprint
  ) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: "Active pointer identity does not match the published release.",
    };
  }
  return null;
}

export function publishedManifestFromStored(input: {
  stored: ContextualContentReleaseManifest;
  expectedRevision: number;
  publishedAt: string;
  publishedBy: string;
}): ContextualContentReleaseManifest {
  return cloneFrozen({
    ...input.stored,
    status: "PUBLISHED",
    revision: input.expectedRevision + 1,
    publishedAt: input.publishedAt,
    publishedBy: input.publishedBy,
  });
}

export function supersededManifestFromStored(input: {
  stored: ContextualContentReleaseManifest;
  expectedRevision: number;
  supersededAt: string;
  supersededByReleaseId: string;
}): ContextualContentReleaseManifest {
  return cloneFrozen({
    ...input.stored,
    status: "SUPERSEDED",
    revision: input.expectedRevision + 1,
    supersededAt: input.supersededAt,
    supersededByReleaseId: input.supersededByReleaseId,
  });
}

export function restoredPublishedManifestFromStored(input: {
  stored: ContextualContentReleaseManifest;
}): ContextualContentReleaseManifest {
  return cloneFrozen({
    ...input.stored,
    status: "PUBLISHED",
    revision: input.stored.revision + 1,
    supersededAt: null,
    supersededByReleaseId: null,
  });
}

export function parsePublishAtom(input: {
  record: ContextualContentReleaseManifest;
  pointer: ContextualContentActiveReleasePointer;
}): {
  record: ContextualContentReleaseManifest;
  pointer: ContextualContentActiveReleasePointer;
} | null {
  const record = parseReleaseManifest(input.record);
  const pointer = parseActiveReleasePointer(input.pointer);
  if (!record || !pointer) {
    return null;
  }
  return { record, pointer };
}
