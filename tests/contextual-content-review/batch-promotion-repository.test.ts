import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID } from "@/contextual-learning/candidate-v0/content";
import { parseBatchPromotionRecord } from "@/contextual-learning/candidate-v0/content";
import { experimentalMealContextLabPack } from "@/contextual-learning/candidate-v0/content";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
import { FileContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/file-promotion-repository";
import { InMemoryContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/in-memory-promotion-repository";
import { promoteContextualContentBatch } from "@/server/contextual-content-promotion/promote-contextual-content-batch";
import { approveBatch03Targets, tempReviewRepository } from "../contextual-content-promotion/helpers";

const WRITE_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
  CONTEXTUAL_PROMOTION_RUNTIME: "memory",
};

describe("batch promotion repository", () => {
  it("creates, retries idempotently, and isolates clones", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const promotions = new InMemoryContextualContentBatchPromotionRepository();
    const first = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: WRITE_ENV,
      reviewRepository: reviews,
      promotionRepository: promotions,
      now: "2026-09-22T06:00:00.000Z",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.message);
    }
    const retry = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: WRITE_ENV,
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) {
      throw new Error(retry.message);
    }
    expect(retry.idempotent).toBe(true);
    expect(retry.record.revision).toBe(1);
    const stored = await promotions.get({
      sceneId: MEAL_RELEASE_SCENE_ID,
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
    });
    expect(() => {
      stored!.promotedBy = "mutated";
    }).toThrow();
    expect(
      (await promotions.get({
        sceneId: MEAL_RELEASE_SCENE_ID,
        packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      }))?.promotedBy,
    ).toBe("LOCAL_INTERNAL_PROMOTER");
    expect(experimentalMealContextLabPack().lexemes).toHaveLength(6);
  });

  it("rejects stale revisions and keeps one winner under concurrency", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const promotions = new InMemoryContextualContentBatchPromotionRepository();
    const first = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: WRITE_ENV,
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(first.ok).toBe(true);
    const stale = await promotions.promoteIfRevision({
      record: {
        ...(first.ok ? first.record : ({} as never)),
        packFingerprint: "changed",
      },
      expectedRevision: 0,
    });
    expect(stale.ok).toBe(false);
    const [left, right] = await Promise.all([
      promoteContextualContentBatch({
        packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
        expectedRevision: 0,
        env: WRITE_ENV,
        reviewRepository: reviews,
        promotionRepository: promotions,
      }),
      promoteContextualContentBatch({
        packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
        expectedRevision: 0,
        env: WRITE_ENV,
        reviewRepository: reviews,
        promotionRepository: promotions,
      }),
    ]);
    expect(left.ok && right.ok).toBe(true);
    expect([left, right].filter((item) => item.ok && item.idempotent)).toHaveLength(2);
    expect(await promotions.listByScene(MEAL_RELEASE_SCENE_ID)).toHaveLength(1);
    expect(parseBatchPromotionRecord({ kind: "nope" })).toBeNull();
  });

  it("persists through the file adapter and fail-closes malformed rows", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const dir = mkdtempSync(path.join(tmpdir(), "batch-promo-file-"));
    const promotions = new FileContextualContentBatchPromotionRepository((input) =>
      path.join(dir, `${input.sceneId}__${input.packId}.json`),
    );
    const created = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: WRITE_ENV,
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const retry = await promotions.createIfAbsent(created.record);
    expect(retry.ok).toBe(true);
    if (!retry.ok) {
      throw new Error(retry.message);
    }
    expect(retry.idempotent).toBe(true);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, `${MEAL_RELEASE_SCENE_ID}__malformed-pack.json`),
      `${JSON.stringify({ kind: "nope", answerKey: true })}\n`,
    );
    expect(
      await promotions.get({
        sceneId: MEAL_RELEASE_SCENE_ID,
        packId: "malformed-pack",
      }),
    ).toBeNull();
    expect(parseBatchPromotionRecord({ kind: "CONTEXTUAL_CONTENT_BATCH_PROMOTION", answerKey: {} })).toBeNull();
  });
});
