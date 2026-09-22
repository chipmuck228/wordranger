import { cloneFrozen } from "../content/immutable";
import {
  CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND,
  CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION,
  RELEASE_ID_PATTERN,
  type ContextualContentActiveReleasePointer,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseActiveReleasePointer(
  value: unknown,
): ContextualContentActiveReleasePointer | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.schemaVersion !== CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION) {
    return null;
  }
  if (value.kind !== CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND) {
    return null;
  }
  if (typeof value.sceneId !== "string" || !value.sceneId.trim()) {
    return null;
  }
  if (typeof value.releaseId !== "string" || !RELEASE_ID_PATTERN.test(value.releaseId)) {
    return null;
  }
  if (typeof value.releaseFingerprint !== "string" || !value.releaseFingerprint) {
    return null;
  }
  if (!Number.isInteger(value.revision) || (value.revision as number) < 0) {
    return null;
  }
  if (typeof value.activatedAt !== "string" || typeof value.activatedBy !== "string") {
    return null;
  }
  return cloneFrozen({
    schemaVersion: CONTEXTUAL_CONTENT_RELEASE_SCHEMA_VERSION,
    kind: CONTEXTUAL_CONTENT_ACTIVE_POINTER_KIND,
    sceneId: value.sceneId,
    releaseId: value.releaseId,
    releaseFingerprint: value.releaseFingerprint,
    revision: value.revision as number,
    activatedAt: value.activatedAt,
    activatedBy: value.activatedBy,
  });
}
