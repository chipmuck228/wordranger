import {
  evaluateBatchPromotionReadiness,
  type BatchPromotionReadiness,
} from "@/contextual-learning/candidate-v0/content";
import {
  listSceneContentRegistry,
  registryEntryFor,
} from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import {
  mealRuntimeContextIdForPack,
  resolveMealRuntimeContext,
} from "@/contextual-learning/candidate-v0/planning/meal-runtime-context";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { CONTENT_REVIEW_BLOCKED_CANDIDATES, CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";

export async function evaluateRegisteredPackPromotionReadiness(input: {
  packId: string;
  reviewRepository?: ContentReviewRepository;
}): Promise<BatchPromotionReadiness> {
  const entry = registryEntryFor(input.packId);
  const parent = entry?.parentPackId ? registryEntryFor(entry.parentPackId) : null;
  const reviewRepository = input.reviewRepository ?? fileContentReviewRepository;
  const records = [];
  for (const spec of CONTENT_REVIEW_TARGETS.filter((item) => item.packId === input.packId)) {
    const record = await reviewRepository.get(spec.reviewKey);
    if (record) {
      records.push(record);
    }
  }
  const runtime = resolveMealRuntimeContext(mealRuntimeContextIdForPack(input.packId));
  const frames = runtime.frames.filter((frame) =>
    entry?.pack.frames.some((item) => item.frameId === frame.id),
  );
  return evaluateBatchPromotionReadiness({
    pack: entry?.pack ?? null,
    registryEntry: entry,
    reviewTargets: CONTENT_REVIEW_TARGETS.map((item) => ({
      reviewKey: item.reviewKey,
      packId: item.packId,
      target: item.target,
      sourceRefs: item.sourceRefs,
    })),
    reviewRecords: records,
    parentPack: parent?.pack ?? null,
    registry: listSceneContentRegistry(),
    frames,
    skeleton: runtime.skeleton,
    cluster: MEAL_SCENE_CLUSTER,
    loadLexeme: bundledSceneLexemeLoader,
    blockedPlannedLemmas: CONTENT_REVIEW_BLOCKED_CANDIDATES.map((item) => item.plannedLemma),
  });
}
