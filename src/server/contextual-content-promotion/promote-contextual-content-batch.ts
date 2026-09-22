import "server-only";

import {
  BATCH_PROMOTION_SCHEMA_VERSION,
  CONTEXTUAL_CONTENT_BATCH_PROMOTION_KIND,
  parseBatchPromotionRecord,
} from "@/contextual-learning/candidate-v0/content";
import { registryEntryFor } from "@/contextual-learning/candidate-v0/content";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
import { isContextualContentReviewWriteEnabled } from "@/server/contextual-content-review/gates";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { createContextualPromotionRepository } from "./create-promotion-runtime";
import { evaluateRegisteredPackPromotionReadiness } from "./evaluate-pack-readiness";
import type { ContextualContentBatchPromotionRepository } from "./promotion-repository";
import { PROMOTION_ACTOR_ID, type PromotionSaveResult } from "./types";

export async function promoteContextualContentBatch(input: {
  packId: string;
  expectedRevision: number;
  now?: string;
  env?: Record<string, string | undefined>;
  reviewRepository?: ContentReviewRepository;
  promotionRepository?: ContextualContentBatchPromotionRepository;
}): Promise<PromotionSaveResult> {
  if (!isContextualContentReviewWriteEnabled(input.env)) {
    return {
      ok: false,
      code: "PROMOTION_WRITE_DISABLED",
      message: "Promotion writes are disabled.",
    };
  }
  if (typeof input.packId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.packId)) {
    return { ok: false, code: "PROMOTION_INVALID", message: "packId is invalid." };
  }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return { ok: false, code: "PROMOTION_INVALID", message: "expectedRevision must be a non-negative integer." };
  }
  const entry = registryEntryFor(input.packId);
  if (!entry) {
    return { ok: false, code: "PROMOTION_INVALID", message: "Unknown Candidate pack." };
  }
  const promotionRepository =
    input.promotionRepository ?? createContextualPromotionRepository(input.env);
  const readiness = await evaluateRegisteredPackPromotionReadiness({
    packId: entry.packId,
    reviewRepository: input.reviewRepository,
  });
  if (!readiness.ok || !readiness.packFingerprint || !readiness.lineageFingerprint) {
    return {
      ok: false,
      code: "PROMOTION_NOT_READY",
      message: readiness.issues[0]?.detail ?? "Batch is not ready for promotion.",
    };
  }
  const record = parseBatchPromotionRecord({
    schemaVersion: BATCH_PROMOTION_SCHEMA_VERSION,
    kind: CONTEXTUAL_CONTENT_BATCH_PROMOTION_KIND,
    sceneId: MEAL_RELEASE_SCENE_ID,
    packId: entry.packId,
    parentPackId: entry.parentPackId ?? null,
    packFingerprint: readiness.packFingerprint,
    lineageFingerprint: readiness.lineageFingerprint,
    targetApprovalBindings: readiness.bindings,
    decision: "PROMOTED",
    revision: Math.max(1, input.expectedRevision + 1),
    promotedAt: input.now ?? new Date().toISOString(),
    promotedBy: PROMOTION_ACTOR_ID,
  });
  if (!record) {
    return { ok: false, code: "PROMOTION_INVALID", message: "Server could not build a promotion record." };
  }
  return promotionRepository.promoteIfRevision({
    record,
    expectedRevision: input.expectedRevision,
  });
}
