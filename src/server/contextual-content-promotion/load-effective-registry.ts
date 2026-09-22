import "server-only";

import {
  listSceneContentRegistry,
  parseBatchPromotionRecord,
  projectEffectiveSceneContentRegistry,
  promotionRecordIsCurrent,
  type ContextualSceneContentRegistryEntry,
} from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { createContextualPromotionRepository } from "./create-promotion-runtime";
import { evaluateRegisteredPackPromotionReadiness } from "./evaluate-pack-readiness";
import { isContextualContentPromotionEnabled } from "./gates";
import type { ContextualContentBatchPromotionRepository } from "./promotion-repository";
import { ContextualPromotionRuntimeError } from "./runtime-mode";
import type { PromotionFailureCode } from "./types";

export type LoadEffectiveRegistryResult = {
  ok: boolean;
  registry: ContextualSceneContentRegistryEntry[];
  activatedPackId: string | null;
  code?: PromotionFailureCode;
  message?: string;
};

export async function loadEffectiveSceneContentRegistry(input: {
  env?: Record<string, string | undefined>;
  reviewRepository?: ContentReviewRepository;
  promotionRepository?: ContextualContentBatchPromotionRepository;
  authoredRegistry?: readonly ContextualSceneContentRegistryEntry[];
} = {}): Promise<LoadEffectiveRegistryResult> {
  const authored = input.authoredRegistry ?? listSceneContentRegistry();
  const env = input.env ?? process.env;
  let promotionRepository = input.promotionRepository;
  if (!promotionRepository) {
    if (!isContextualContentPromotionEnabled(env)) {
      return {
        ok: true,
        registry: [...authored],
        activatedPackId: null,
      };
    }
    try {
      promotionRepository = createContextualPromotionRepository(env);
    } catch (error) {
      if (error instanceof ContextualPromotionRuntimeError) {
        return {
          ok: false,
          registry: [...authored],
          activatedPackId: null,
          code: error.code,
          message: error.message,
        };
      }
      throw error;
    }
  }
  try {
    const stored = await promotionRepository.listByScene(MEAL_RELEASE_SCENE_ID);
    const effectiveIds: string[] = [];
    for (const raw of stored) {
      const parsed = parseBatchPromotionRecord(raw);
      if (!parsed) {
        continue;
      }
      const readiness = await evaluateRegisteredPackPromotionReadiness({
        packId: parsed.packId,
        reviewRepository: input.reviewRepository,
      });
      if (promotionRecordIsCurrent({ record: parsed, readiness })) {
        effectiveIds.push(parsed.packId);
      }
    }
    const projected = projectEffectiveSceneContentRegistry({
      authoredRegistry: authored,
      sceneClusterId: MEAL_SCENE_CLUSTER.id,
      effectivePromotionPackIds: effectiveIds,
    });
    return {
      ok: projected.ok,
      registry: projected.registry,
      activatedPackId: projected.activatedPackId,
    };
  } catch (error) {
    if (error instanceof ContextualPromotionRuntimeError) {
      return {
        ok: false,
        registry: [...authored],
        activatedPackId: null,
        code: error.code,
        message: error.message,
      };
    }
    throw error;
  }
}
