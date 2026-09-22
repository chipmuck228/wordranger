import { fingerprintAuthoredPack, listSceneContentRegistry, registryEntryFor } from "@/contextual-learning/candidate-v0/content";
import { promotionRecordIsCurrent } from "@/contextual-learning/candidate-v0/content";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
import { evaluateRegisteredPackPromotionReadiness } from "@/server/contextual-content-promotion/evaluate-pack-readiness";
import { createContextualPromotionRepository } from "@/server/contextual-content-promotion/create-promotion-runtime";
import { isContextualContentPromotionEnabled, isContextualContentPromotionWriteEnabled } from "@/server/contextual-content-promotion/gates";
import { loadEffectiveSceneContentRegistry } from "@/server/contextual-content-promotion/load-effective-registry";
import type { ContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/promotion-repository";
import { ContextualPromotionRuntimeError } from "@/server/contextual-content-promotion/runtime-mode";
import type { ContentReviewRepository } from "./content-review-repository";
import { isContextualContentReviewWriteEnabled } from "./gates";
import { listContentReviewTargets } from "./list-review-targets";
import { CONTENT_REVIEW_BLOCKED_CANDIDATES, CONTENT_REVIEW_TARGETS } from "./review-target-registry";
import type { ContentReviewBatchSummary } from "./types";

function batchTitle(batchId: string): string {
  const first = CONTENT_REVIEW_TARGETS.find((item) => item.batchId === batchId);
  return first?.title.replace(/\s·\s.+$/, "") ?? batchId;
}

export async function listContentReviewBatches(input: {
  env?: Record<string, string | undefined>;
  reviewRepository?: ContentReviewRepository;
  promotionRepository?: ContextualContentBatchPromotionRepository;
} = {}): Promise<ContentReviewBatchSummary[]> {
  const env = input.env ?? process.env;
  const items = await listContentReviewTargets();
  const batchIds = [...new Set(CONTENT_REVIEW_TARGETS.map((item) => item.batchId))];
  const promotionEnabled = isContextualContentPromotionEnabled(env);
  const promotionWriteEnabled = isContextualContentPromotionWriteEnabled(env);
  let promotionRepository = input.promotionRepository;
  let promotionConfigError: { code: string; message: string } | null = null;
  if (promotionEnabled && !promotionRepository) {
    try {
      promotionRepository = createContextualPromotionRepository(env);
    } catch (error) {
      if (error instanceof ContextualPromotionRuntimeError) {
        promotionConfigError = { code: error.code, message: error.message };
      } else {
        throw error;
      }
    }
  }
  const effective = promotionRepository
    ? await loadEffectiveSceneContentRegistry({
        env,
        promotionRepository,
        reviewRepository: input.reviewRepository,
      })
    : {
        ok: true,
        registry: listSceneContentRegistry(),
        activatedPackId: null,
        code: promotionConfigError?.code,
        message: promotionConfigError?.message,
      };
  if (!effective.ok && effective.code && !promotionConfigError) {
    promotionConfigError = {
      code: effective.code,
      message: effective.message ?? "Promotion runtime is unavailable.",
    };
  }
  const summaries: ContentReviewBatchSummary[] = [];
  for (const batchId of batchIds) {
    const targets = items.filter((item) => item.batchId === batchId);
    const blockedCandidates = CONTENT_REVIEW_BLOCKED_CANDIDATES.filter(
      (item) => item.batchId === batchId,
    );
    const packId = CONTENT_REVIEW_TARGETS.find((item) => item.batchId === batchId)?.packId ?? "";
    const entry = packId ? registryEntryFor(packId) : null;
    const pending = targets.filter((item) => item.statusLabel === "PENDING").length;
    const approved = targets.filter((item) => item.statusLabel === "APPROVED").length;
    const rejected = targets.filter((item) => item.statusLabel === "REJECTED").length;
    const stale = targets.filter((item) => item.statusLabel === "STALE_REVIEW").length;
    let stored = null;
    if (packId && promotionRepository && !promotionConfigError) {
      try {
        stored = await promotionRepository.get({ sceneId: MEAL_RELEASE_SCENE_ID, packId });
      } catch (error) {
        if (error instanceof ContextualPromotionRuntimeError) {
          promotionConfigError = { code: error.code, message: error.message };
        } else {
          throw error;
        }
      }
    }
    const readiness = packId
      ? await evaluateRegisteredPackPromotionReadiness({
          packId,
          reviewRepository: input.reviewRepository,
        })
      : { ok: false, issues: [], packFingerprint: null, lineageFingerprint: null, bindings: [] };
    const currentPromotion = stored && promotionRecordIsCurrent({ record: stored, readiness });
    const effectiveEntry = effective.registry.find((item) => item.packId === packId);
    const reviewCompleteUnpromoted =
      targets.length > 0 &&
      approved === targets.length &&
      stale === 0 &&
      entry?.status === "CANDIDATE" &&
      (entry.releaseEligibility ?? "NONE") === "NONE" &&
      !currentPromotion;
    summaries.push({
      batchId,
      title: batchTitle(batchId),
      packId,
      registryStatus: entry?.status ?? "DRAFT",
      releaseEligibility: entry?.releaseEligibility ?? "NONE",
      totalAuthored: targets.length,
      pending,
      approved,
      rejected,
      stale,
      blocked: blockedCandidates.length,
      reviewCompleteUnpromoted,
      packFingerprint: entry ? fingerprintAuthoredPack(entry.pack) : null,
      parentPackId: entry?.parentPackId ?? null,
      lineageOk: !readiness.issues.some(
        (item) => item.code === "PROMOTION_LINEAGE_INVALID" || item.code === "PROMOTION_LINEAGE_CYCLE",
      ),
      promotionReady: promotionEnabled && !promotionConfigError && readiness.ok && !currentPromotion,
      promotionIssues: promotionConfigError
        ? [`${promotionConfigError.code}: ${promotionConfigError.message}`]
        : readiness.issues.map((item) => `${item.code}: ${item.detail}`),
      promotionStatus: currentPromotion ? "PROMOTED" : stored ? "STALE" : "NONE",
      promotionRevision: stored?.revision ?? 0,
      promotedAt: stored?.promotedAt ?? null,
      promotedBy: stored?.promotedBy ?? null,
      effectiveReleaseEligibility: effectiveEntry?.releaseEligibility ?? "NONE",
      writeEnabled: isContextualContentReviewWriteEnabled(env),
      promotionEnabled,
      promotionWriteEnabled,
      promotionConfigError,
      expectedPromotionRevision: stored?.revision ?? 0,
      targets,
      blockedCandidates: blockedCandidates.map((item) => ({
        batchId: item.batchId,
        plannedLemma: item.plannedLemma,
        reason: item.reason,
      })),
    });
  }
  return summaries;
}
