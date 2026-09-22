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
import type { ContextualContentBatchPromotionRepository } from "./promotion-repository";

export async function loadEffectiveSceneContentRegistry(input: {
  env?: Record<string, string | undefined>;
  reviewRepository?: ContentReviewRepository;
  promotionRepository?: ContextualContentBatchPromotionRepository;
  authoredRegistry?: readonly ContextualSceneContentRegistryEntry[];
} = {}): Promise<{
  ok: boolean;
  registry: ContextualSceneContentRegistryEntry[];
  activatedPackId: string | null;
}> {
  const authored = input.authoredRegistry ?? listSceneContentRegistry();
  const promotionRepository =
    input.promotionRepository ?? createContextualPromotionRepository(input.env);
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
}
