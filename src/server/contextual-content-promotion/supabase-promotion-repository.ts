import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cloneFrozen } from "@/contextual-learning/candidate-v0/content/immutable";
import {
  parseBatchPromotionRecord,
  type ContextualContentBatchPromotionRecord,
} from "@/contextual-learning/candidate-v0/content";
import type { ContextualContentBatchPromotionRepository } from "./promotion-repository";
import { ContextualPromotionRuntimeError } from "./runtime-mode";
import type { PromotionSaveResult } from "./types";

function throwIfPromotionStoreUnavailable(error: { message?: string; code?: string } | null): void {
  if (!error) {
    return;
  }
  const message = error.message ?? "";
  const code = error.code ?? "";
  if (
    /does not exist|Could not find the table|Could not find the function|schema cache/i.test(message) ||
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" ||
    code === "PGRST205"
  ) {
    throw new ContextualPromotionRuntimeError(
      "PROMOTION_RUNTIME_INVALID",
      "Promotion store is unavailable. Apply the contextual content batch promotions migration before using CONTEXTUAL_PROMOTION_RUNTIME=supabase.",
    );
  }
}

interface PromotionRow {
  scene_id: string;
  pack_id: string;
  schema_version: string;
  revision: number;
  pack_fingerprint: string;
  record: unknown;
}

function parseRow(row: PromotionRow | null): ContextualContentBatchPromotionRecord | null {
  if (!row) {
    return null;
  }
  const parsed = parseBatchPromotionRecord(row.record);
  if (
    !parsed ||
    parsed.sceneId !== row.scene_id ||
    parsed.packId !== row.pack_id ||
    parsed.revision !== row.revision ||
    parsed.schemaVersion !== row.schema_version ||
    parsed.packFingerprint !== row.pack_fingerprint
  ) {
    return null;
  }
  return parsed;
}

export class SupabaseContextualContentBatchPromotionRepository
  implements ContextualContentBatchPromotionRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async get(input: { sceneId: string; packId: string }): Promise<ContextualContentBatchPromotionRecord | null> {
    const { data, error } = await this.client
      .from("contextual_content_batch_promotions")
      .select("scene_id, pack_id, schema_version, revision, pack_fingerprint, record")
      .eq("scene_id", input.sceneId)
      .eq("pack_id", input.packId)
      .maybeSingle();
    throwIfPromotionStoreUnavailable(error);
    if (error || !data) {
      return null;
    }
    return parseRow(data as PromotionRow);
  }

  async listByScene(sceneId: string): Promise<ContextualContentBatchPromotionRecord[]> {
    const { data, error } = await this.client
      .from("contextual_content_batch_promotions")
      .select("scene_id, pack_id, schema_version, revision, pack_fingerprint, record")
      .eq("scene_id", sceneId)
      .order("pack_id");
    throwIfPromotionStoreUnavailable(error);
    if (error || !data) {
      return [];
    }
    return (data as PromotionRow[])
      .map((row) => parseRow(row))
      .filter((item): item is ContextualContentBatchPromotionRecord => Boolean(item));
  }

  async createIfAbsent(record: ContextualContentBatchPromotionRecord): Promise<PromotionSaveResult> {
    return this.promoteIfRevision({ record, expectedRevision: 0 });
  }

  async promoteIfRevision(input: {
    record: ContextualContentBatchPromotionRecord;
    expectedRevision: number;
  }): Promise<PromotionSaveResult> {
    const parsed = parseBatchPromotionRecord(input.record);
    if (!parsed) {
      return { ok: false, code: "PROMOTION_INVALID", message: "Promotion record is malformed." };
    }
    const { data, error } = await this.client.rpc("promote_contextual_content_batch", {
      p_scene_id: parsed.sceneId,
      p_pack_id: parsed.packId,
      p_expected_revision: input.expectedRevision,
      p_record: parsed,
    });
    if (error) {
      try {
        throwIfPromotionStoreUnavailable(error);
      } catch (storeError) {
        if (storeError instanceof ContextualPromotionRuntimeError) {
          return { ok: false, code: storeError.code, message: storeError.message };
        }
        throw storeError;
      }
      const message = error.message;
      if (/PROMOTION_CONFLICT/i.test(message)) {
        return { ok: false, code: "PROMOTION_CONFLICT", message };
      }
      if (/PROMOTION_STALE/i.test(message)) {
        return { ok: false, code: "PROMOTION_STALE", message };
      }
      return { ok: false, code: "PROMOTION_INVALID", message };
    }
    const payload = data as { record?: unknown; idempotent?: boolean } | null;
    const saved = parseBatchPromotionRecord(payload?.record);
    if (!saved) {
      return { ok: false, code: "PROMOTION_INVALID", message: "RPC returned a malformed promotion." };
    }
    return {
      ok: true,
      record: cloneFrozen(saved),
      idempotent: payload?.idempotent === true,
    };
  }
}
