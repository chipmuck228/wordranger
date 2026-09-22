import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  fingerprintsForManifest,
  parseActiveReleasePointer,
  parseReleaseManifest,
  type ContextualContentActiveReleasePointer,
  type ContextualContentReleaseManifest,
} from "@/contextual-learning/candidate-v0/release";
import type {
  ActiveReleaseLoadResult,
  ContextualContentReleaseRepository,
  PublishAtomicResult,
  RollbackPointerResult,
} from "./release-repository";
import {
  ReleasePersistenceInconsistencyError,
  RELEASE_ROW_SELECT_COLUMNS,
  releaseRowManifestMismatch,
  type ContextualContentReleaseRow,
} from "./row-manifest-consistency";
import type { ReleaseSaveResult } from "./types";

interface PointerRow {
  scene_id: string;
  schema_version: string;
  release_id: string;
  release_fingerprint: string;
  revision: number;
  activated_at: string;
  activated_by: string;
}

export class SupabaseContextualContentReleaseRepository
  implements ContextualContentReleaseRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async create(input: {
    record: ContextualContentReleaseManifest;
  }): Promise<ReleaseSaveResult> {
    const parsed = parseReleaseManifest(input.record);
    if (!parsed || parsed.revision !== 0 || parsed.status !== "DRAFT") {
      return { ok: false, code: "RELEASE_INVALID", message: "New releases must be DRAFT at revision 0." };
    }
    const existing = await this.get(parsed.releaseId);
    if (existing) {
      if (existing.releaseFingerprint === parsed.releaseFingerprint && existing.status === "DRAFT") {
        return { ok: true, record: existing, idempotent: true };
      }
      return { ok: false, code: "RELEASE_CONFLICT", message: "Release id already exists." };
    }
    const { error } = await this.client.from("contextual_content_releases").insert(toRow(parsed));
    if (error) {
      return { ok: false, code: "RELEASE_RUNTIME_INVALID", message: error.message };
    }
    return { ok: true, record: cloneFrozen(parsed), idempotent: false };
  }

  async get(releaseId: string): Promise<ContextualContentReleaseManifest | null> {
    const { data, error } = await this.client
      .from("contextual_content_releases")
      .select(RELEASE_ROW_SELECT_COLUMNS)
      .eq("release_id", releaseId)
      .maybeSingle();
    if (error || !data) {
      return null;
    }
    return parseConsistentReleaseRow(data as unknown as ContextualContentReleaseRow, releaseId);
  }

  async list(): Promise<ContextualContentReleaseManifest[]> {
    const { data, error } = await this.client
      .from("contextual_content_releases")
      .select(RELEASE_ROW_SELECT_COLUMNS)
      .order("release_id");
    if (error || !data) {
      return [];
    }
    return data.map((row) => parseConsistentReleaseRow(row as unknown as ContextualContentReleaseRow));
  }

  async listByScene(sceneId: string): Promise<ContextualContentReleaseManifest[]> {
    const listed = await this.list();
    return listed.filter((item) => item.sceneId === sceneId);
  }

  async saveIfRevision(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult> {
    const parsed = parseReleaseManifest(input.record);
    if (!parsed) {
      return { ok: false, code: "RELEASE_INVALID", message: "Malformed release schema." };
    }
    const existing = await this.get(parsed.releaseId);
    if (!existing) {
      return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
    }
    if (
      existing.releaseFingerprint === parsed.releaseFingerprint &&
      existing.status === parsed.status &&
      existing.revision === parsed.revision &&
      existing.validatedAt === parsed.validatedAt &&
      existing.publishedAt === parsed.publishedAt
    ) {
      return { ok: true, record: existing, idempotent: true };
    }
    if (existing.revision !== input.expectedRevision) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Another release write happened first." };
    }
    const stored = cloneFrozen({ ...parsed, revision: input.expectedRevision + 1 });
    const { data, error } = await this.client
      .from("contextual_content_releases")
      .update(toRow(stored))
      .eq("release_id", stored.releaseId)
      .eq("revision", input.expectedRevision)
      .select("release_id");
    if (error || !data?.length) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Another release write happened first." };
    }
    return { ok: true, record: stored, idempotent: false };
  }

  async discard(input: {
    releaseId: string;
    expectedRevision: number;
  }): Promise<ReleaseSaveResult> {
    const existing = await this.get(input.releaseId);
    if (!existing) {
      return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
    }
    if (existing.revision !== input.expectedRevision) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Another release write happened first." };
    }
    if (existing.status !== "DRAFT" && existing.status !== "PREFLIGHT_VALIDATED") {
      return { ok: false, code: "RELEASE_INVALID", message: "Only local drafts can be discarded." };
    }
    const { error } = await this.client
      .from("contextual_content_releases")
      .delete()
      .eq("release_id", input.releaseId)
      .eq("revision", input.expectedRevision);
    if (error) {
      return { ok: false, code: "RELEASE_CONFLICT", message: "Another release write happened first." };
    }
    return { ok: true, record: existing, idempotent: false };
  }

  async getActivePointer(
    sceneId: string,
  ): Promise<ContextualContentActiveReleasePointer | null> {
    const { data, error } = await this.client
      .from("contextual_content_active_release_pointers")
      .select("*")
      .eq("scene_id", sceneId)
      .maybeSingle();
    if (error || !data) {
      return null;
    }
    return parsePointerRow(data as PointerRow);
  }

  async loadActiveRelease(sceneId: string): Promise<ActiveReleaseLoadResult> {
    const pointer = await this.getActivePointer(sceneId);
    if (!pointer) {
      return { ok: false, code: "RELEASE_POINTER_INVALID", message: "No active release pointer." };
    }
    let release: ContextualContentReleaseManifest | null;
    try {
      release = await this.get(pointer.releaseId);
    } catch (error) {
      if (error instanceof ReleasePersistenceInconsistencyError) {
        return { ok: false, code: "RELEASE_POINTER_MISMATCH", message: error.message };
      }
      throw error;
    }
    if (!release) {
      return { ok: false, code: "RELEASE_NOT_FOUND", message: "Active release is missing." };
    }
    if (
      release.status !== "PUBLISHED" ||
      release.sceneId !== sceneId ||
      pointer.releaseFingerprint !== release.releaseFingerprint ||
      fingerprintsForManifest(release).releaseFingerprint !== release.releaseFingerprint
    ) {
      return { ok: false, code: "RELEASE_POINTER_MISMATCH", message: "Active pointer failed closed." };
    }
    return { ok: true, pointer, release };
  }

  async publishAtomic(input: {
    record: ContextualContentReleaseManifest;
    expectedRevision: number;
    pointer: ContextualContentActiveReleasePointer;
    expectedPointerRevision: number | null;
    superseded?: {
      record: ContextualContentReleaseManifest;
      expectedRevision: number;
    };
  }): Promise<PublishAtomicResult> {
    const { data, error } = await this.client.rpc("publish_contextual_content_release", {
      p_release_id: input.record.releaseId,
      p_expected_revision: input.expectedRevision,
      p_published_manifest: input.record,
      p_pointer: input.pointer,
      p_expected_pointer_revision: input.expectedPointerRevision,
      p_supersede_release_id: input.superseded?.record.releaseId ?? null,
      p_supersede_expected_revision: input.superseded?.expectedRevision ?? null,
      p_supersede_manifest: input.superseded?.record ?? null,
    });
    if (error) {
      return { ok: false, code: "RELEASE_RUNTIME_INVALID", message: error.message };
    }
    const payload = data as { ok?: boolean; code?: string; idempotent?: boolean };
    if (!payload?.ok) {
      return {
        ok: false,
        code: (payload?.code as PublishAtomicResult extends { ok: false } ? PublishAtomicResult["code"] : never) ?? "RELEASE_INVALID",
        message: "Publish transaction failed.",
      };
    }
    let record: ContextualContentReleaseManifest | null;
    try {
      record = await this.get(input.record.releaseId);
    } catch (error) {
      if (error instanceof ReleasePersistenceInconsistencyError) {
        return { ok: false, code: "RELEASE_RUNTIME_INVALID", message: error.message };
      }
      throw error;
    }
    const pointer = await this.getActivePointer(input.pointer.sceneId);
    if (!record || !pointer) {
      return { ok: false, code: "RELEASE_RUNTIME_INVALID", message: "Publish transaction did not persist." };
    }
    return {
      ok: true,
      record,
      pointer,
      superseded: input.superseded ? await this.get(input.superseded.record.releaseId) : null,
      idempotent: payload.idempotent === true,
    };
  }

  async rollbackPointer(input: {
    sceneId: string;
    expectedPointerRevision: number;
    pointer: ContextualContentActiveReleasePointer;
  }): Promise<RollbackPointerResult> {
    const { data, error } = await this.client.rpc("rollback_contextual_content_active_release", {
      p_scene_id: input.sceneId,
      p_expected_pointer_revision: input.expectedPointerRevision,
      p_target_release_id: input.pointer.releaseId,
      p_pointer: input.pointer,
    });
    if (error) {
      return { ok: false, code: "RELEASE_RUNTIME_INVALID", message: error.message };
    }
    const payload = data as { ok?: boolean; code?: string; idempotent?: boolean };
    if (!payload?.ok) {
      return {
        ok: false,
        code: (payload?.code as RollbackPointerResult extends { ok: false } ? RollbackPointerResult["code"] : never) ?? "RELEASE_INVALID",
        message: "Rollback transaction failed.",
      };
    }
    const pointer = await this.getActivePointer(input.sceneId);
    let target: ContextualContentReleaseManifest | null;
    try {
      target = await this.get(input.pointer.releaseId);
    } catch (error) {
      if (error instanceof ReleasePersistenceInconsistencyError) {
        return { ok: false, code: "RELEASE_RUNTIME_INVALID", message: error.message };
      }
      throw error;
    }
    if (!pointer || !target) {
      return { ok: false, code: "RELEASE_NOT_FOUND", message: "Release was not found." };
    }
    return { ok: true, pointer, target, idempotent: payload.idempotent === true };
  }
}

function toRow(record: ContextualContentReleaseManifest): Record<string, unknown> {
  return {
    release_id: record.releaseId,
    user_id: "00000000-0000-4000-8000-000000000001",
    schema_version: record.schemaVersion,
    scene_id: record.sceneId,
    status: record.status,
    revision: record.revision,
    manifest: record,
    published_at: record.publishedAt,
    published_by: record.publishedBy,
    superseded_at: record.supersededAt,
    superseded_by_release_id: record.supersededByReleaseId,
  };
}

function parsePointerRow(row: PointerRow): ContextualContentActiveReleasePointer | null {
  return parseActiveReleasePointer({
    schemaVersion: row.schema_version,
    kind: "CANDIDATE_V0_ACTIVE_RELEASE_POINTER",
    sceneId: row.scene_id,
    releaseId: row.release_id,
    releaseFingerprint: row.release_fingerprint,
    revision: row.revision,
    activatedAt: row.activated_at,
    activatedBy: row.activated_by,
  });
}

function parseConsistentReleaseRow(
  row: ContextualContentReleaseRow,
  releaseId?: string,
): ContextualContentReleaseManifest {
  const parsed = parseReleaseManifest(row.manifest);
  if (!parsed) {
    throw new ReleasePersistenceInconsistencyError(
      `Release ${releaseId ?? row.release_id} manifest is unreadable.`,
    );
  }
  const mismatch = releaseRowManifestMismatch(row, parsed);
  if (mismatch) {
    throw new ReleasePersistenceInconsistencyError(
      `Release ${parsed.releaseId} row/manifest mismatch: ${mismatch}`,
    );
  }
  return cloneFrozen(parsed);
}

export type { ContextualContentReleaseRow as ReleaseRow };
