import type { ContextualContentReleaseManifest } from "@/contextual-learning/candidate-v0/release";

export const RELEASE_ROW_SELECT_COLUMNS = [
  "release_id",
  "scene_id",
  "status",
  "revision",
  "schema_version",
  "published_at",
  "published_by",
  "superseded_at",
  "superseded_by_release_id",
  "manifest",
].join(", ");

export interface ContextualContentReleaseRow {
  release_id: string;
  scene_id: string;
  status: string;
  revision: number | string;
  schema_version: string;
  published_at: string | null;
  published_by: string | null;
  superseded_at: string | null;
  superseded_by_release_id: string | null;
  manifest: unknown;
}

export class ReleasePersistenceInconsistencyError extends Error {
  readonly code = "RELEASE_RUNTIME_INVALID" as const;

  constructor(message: string) {
    super(message);
    this.name = "ReleasePersistenceInconsistencyError";
  }
}

function sameTimestamp(left: string | null, right: string | null): boolean {
  if (left == null && right == null) {
    return true;
  }
  if (left == null || right == null) {
    return false;
  }
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && leftMs === rightMs;
}

export function releaseRowManifestMismatch(
  row: ContextualContentReleaseRow,
  manifest: ContextualContentReleaseManifest,
): string | null {
  const revision = typeof row.revision === "string" ? Number(row.revision) : row.revision;
  if (row.release_id !== manifest.releaseId) {
    return `row.release_id=${row.release_id} !== manifest.releaseId=${manifest.releaseId}`;
  }
  if (row.scene_id !== manifest.sceneId) {
    return `row.scene_id=${row.scene_id} !== manifest.sceneId=${manifest.sceneId}`;
  }
  if (row.status !== manifest.status) {
    return `row.status=${row.status} !== manifest.status=${manifest.status}`;
  }
  if (revision !== manifest.revision) {
    return `row.revision=${row.revision} !== manifest.revision=${manifest.revision}`;
  }
  if (row.schema_version !== manifest.schemaVersion) {
    return `row.schema_version=${row.schema_version} !== manifest.schemaVersion=${manifest.schemaVersion}`;
  }
  if (!sameTimestamp(row.published_at, manifest.publishedAt)) {
    return `row.published_at !== manifest.publishedAt`;
  }
  if ((row.published_by ?? null) !== manifest.publishedBy) {
    return `row.published_by !== manifest.publishedBy`;
  }
  if (!sameTimestamp(row.superseded_at, manifest.supersededAt)) {
    return `row.superseded_at !== manifest.supersededAt`;
  }
  if ((row.superseded_by_release_id ?? null) !== manifest.supersededByReleaseId) {
    return `row.superseded_by_release_id !== manifest.supersededByReleaseId`;
  }
  return null;
}
