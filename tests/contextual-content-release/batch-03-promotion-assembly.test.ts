import { describe, expect, it } from "vitest";
import {
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_03_PACK,
  MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
  experimentalMealContextLabPack,
} from "@/contextual-learning/candidate-v0/content";
import { InMemoryContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/in-memory-promotion-repository";
import { promoteContextualContentBatch } from "@/server/contextual-content-promotion/promote-contextual-content-batch";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { inspectMealReleaseEligibility } from "@/server/contextual-content-release/inspect-release-eligibility";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";
import { approveBatch03Targets, tempReviewRepository, withFallbackReviews } from "../contextual-content-promotion/helpers";

const WRITE_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
  CONTEXTUAL_PROMOTION_RUNTIME: "memory",
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
  CONTEXTUAL_RELEASE_RUNTIME: "memory",
};

describe("batch-03 promotion release assembly", () => {
  it("creates a nine-word draft only while promotion and reviews stay current", async () => {
    const seeded = tempReviewRepository();
    await approveBatch03Targets(seeded);
    const reviews = withFallbackReviews(seeded);
    const promotions = new InMemoryContextualContentBatchPromotionRepository();
    const promoted = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: WRITE_ENV,
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(promoted.ok).toBe(true);
    const eligibility = await inspectMealReleaseEligibility({
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(eligibility.packId).toBe(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID);
    expect(eligibility.targetCount).toBe(9);
    const releases = new InMemoryContextualContentReleaseRepository();
    const created = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: releases,
      reviewRepository: reviews,
      promotionRepository: promotions,
      now: "2026-09-22T07:00:00.000Z",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(`${created.code}: ${created.message}`);
    }
    expect(created.record.targetEntries).toHaveLength(9);
    expect(created.record.historicalApprovalBindings).toHaveLength(9);
    expect(
      created.record.targetEntries.filter((item) =>
        ["knife#eating-tool", "bread#solid-food", "water#drinkable-liquid"].includes(item.target.senseId),
      ),
    ).toHaveLength(3);
    const preflight = await preflightContextualContentRelease({
      env: WRITE_ENV,
      repository: releases,
      reviewRepository: reviews,
      promotionRepository: promotions,
      releaseId: created.record.releaseId,
      revision: created.record.revision,
    });
    expect(preflight.ok).toBe(true);
    expect(created.record.status).toBe("DRAFT");
    expect(experimentalMealContextLabPack().id).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID);

    const missingSeed = tempReviewRepository();
    await approveBatch03Targets(missingSeed, ["knife", "bread"]);
    const withoutWater = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      reviewRepository: missingSeed,
      promotionRepository: promotions,
      pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
    });
    expect(withoutWater.ok).toBe(false);

    const emptyPromotions = new InMemoryContextualContentBatchPromotionRepository();
    const withoutPromotion = await createMealMigrationDraft({
      env: WRITE_ENV,
      repository: new InMemoryContextualContentReleaseRepository(),
      reviewRepository: reviews,
      promotionRepository: emptyPromotions,
      pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
    });
    expect(withoutPromotion.ok).toBe(false);
  });
});
