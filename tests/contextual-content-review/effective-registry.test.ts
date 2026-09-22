import { describe, expect, it } from "vitest";
import {
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
  experimentalMealContextLabPack,
  listSceneContentRegistry,
  projectEffectiveSceneContentRegistry,
} from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { InMemoryContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/in-memory-promotion-repository";
import { loadEffectiveSceneContentRegistry } from "@/server/contextual-content-promotion/load-effective-registry";
import { promoteContextualContentBatch } from "@/server/contextual-content-promotion/promote-contextual-content-batch";
import { approveBatch03Targets, tempReviewRepository } from "../contextual-content-promotion/helpers";

const WRITE_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
};

describe("effective scene content registry", () => {
  it("keeps batch-02 eligible until a current promotion exists", async () => {
    const authored = listSceneContentRegistry();
    expect(authored.find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)?.status).toBe(
      "CANDIDATE",
    );
    const empty = await loadEffectiveSceneContentRegistry({
      promotionRepository: new InMemoryContextualContentBatchPromotionRepository(),
    });
    expect(empty.activatedPackId).toBeNull();
    expect(empty.registry.find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID)?.releaseEligibility).toBe(
      "RELEASE_ELIGIBLE",
    );
    expect(empty.registry.find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)?.status).toBe(
      "CANDIDATE",
    );
  });

  it("projects batch-03 eligibility only for a current promotion and fail-closes siblings", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const promotions = new InMemoryContextualContentBatchPromotionRepository();
    const promoted = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: WRITE_ENV,
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(promoted.ok).toBe(true);
    const effective = await loadEffectiveSceneContentRegistry({
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(effective.ok).toBe(true);
    expect(effective.activatedPackId).toBe(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID);
    expect(effective.registry.find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)).toMatchObject({
      status: "APPROVED_FOR_EXPERIMENT",
      releaseEligibility: "RELEASE_ELIGIBLE",
    });
    expect(effective.registry.find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID)?.releaseEligibility).toBe(
      "NONE",
    );
    expect(listSceneContentRegistry().find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)?.status).toBe(
      "CANDIDATE",
    );
    expect(experimentalMealContextLabPack().id).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID);

    const stalePromotions = new InMemoryContextualContentBatchPromotionRepository();
    await stalePromotions.promoteIfRevision({
      record: {
        ...(promoted.ok ? promoted.record : ({} as never)),
        packFingerprint: "stale-pack",
      },
      expectedRevision: 0,
    });
    const stale = await loadEffectiveSceneContentRegistry({
      reviewRepository: reviews,
      promotionRepository: stalePromotions,
    });
    expect(stale.activatedPackId).toBeNull();
    expect(stale.registry.find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID)?.releaseEligibility).toBe(
      "RELEASE_ELIGIBLE",
    );
  });

  it("fail-closes sibling promotions instead of guessing the newest pack id", () => {
    const authored = listSceneContentRegistry().map((entry) => structuredClone(entry));
    const sibling = structuredClone(
      authored.find((entry) => entry.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)!,
    );
    sibling.packId = "meal-scene-expansion-batch-03-sibling";
    sibling.pack = { ...sibling.pack, id: sibling.packId };
    authored.push(sibling);
    const projected = projectEffectiveSceneContentRegistry({
      authoredRegistry: authored,
      sceneClusterId: MEAL_SCENE_CLUSTER.id,
      effectivePromotionPackIds: [
        MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
        "meal-scene-expansion-batch-03-sibling",
      ],
    });
    expect(projected.ok).toBe(false);
    expect(projected.activatedPackId).toBeNull();
    expect(
      projected.registry.find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)?.status,
    ).toBe("CANDIDATE");
    expect(
      projected.registry.find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID)?.releaseEligibility,
    ).toBe("RELEASE_ELIGIBLE");
  });
});
