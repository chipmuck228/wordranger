import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { promoteReviewedBatch } from "@/app/debug/contextual-content-review/actions";
import { MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID } from "@/contextual-learning/candidate-v0/content";
import { resetMemoryContextualPromotionRepositoryForTests } from "@/server/contextual-content-promotion/create-promotion-runtime";
import {
  isContextualContentPromotionEnabled,
  isContextualContentPromotionWriteEnabled,
} from "@/server/contextual-content-promotion/gates";
import { InMemoryContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/in-memory-promotion-repository";
import { promoteContextualContentBatch } from "@/server/contextual-content-promotion/promote-contextual-content-batch";
import { isContextualContentReviewWriteEnabled } from "@/server/contextual-content-review/gates";
import { saveContentReviewDecision } from "@/server/contextual-content-review/save-review-decision";
import { currentContentFingerprint } from "@/server/contextual-content-review/project-review-packet";
import { CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { isContextualContentReleaseWriteEnabled } from "@/server/contextual-content-release/gates";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import { approveBatch03Targets, tempReviewRepository } from "./helpers";

afterEach(() => {
  resetMemoryContextualPromotionRepositoryForTests();
});

const REVIEW_WRITE = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
};

const PROMOTION_WRITE = {
  ...REVIEW_WRITE,
  CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
  CONTEXTUAL_PROMOTION_RUNTIME: "memory",
};

describe("independent promotion gates", () => {
  it("keeps review write and promotion write independent", () => {
    const reviewOnPromotionOff = {
      ...REVIEW_WRITE,
      CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
      CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
    };
    expect(isContextualContentReviewWriteEnabled(reviewOnPromotionOff)).toBe(true);
    expect(isContextualContentPromotionWriteEnabled(reviewOnPromotionOff)).toBe(false);

    const writeWithoutEnabled = {
      CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0",
      CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
    };
    expect(isContextualContentPromotionEnabled(writeWithoutEnabled)).toBe(false);
    expect(isContextualContentPromotionWriteEnabled(writeWithoutEnabled)).toBe(false);

    expect(isContextualContentPromotionWriteEnabled(PROMOTION_WRITE)).toBe(true);
    expect(
      isContextualContentPromotionWriteEnabled({
        ...PROMOTION_WRITE,
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
  });

  it("lets review save while refusing promote when promotion write is off", async () => {
    const reviews = tempReviewRepository();
    const spec = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === "knife")!;
    const saved = await saveContentReviewDecision({
      fingerprint: currentContentFingerprint(spec)!,
      revision: 0,
      decision: "APPROVED",
      notes: [],
      env: {
        ...REVIEW_WRITE,
        CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
        CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
      },
      repository: reviews,
      syncMarkdown: false,
    });
    expect(saved.ok).toBe(true);
    const stored = await reviews.get(spec.reviewKey);
    expect(stored?.decision).toBe("APPROVED");

    const promoted = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: {
        ...REVIEW_WRITE,
        CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
        CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
        CONTEXTUAL_PROMOTION_RUNTIME: "memory",
      },
      reviewRepository: reviews,
      promotionRepository: new InMemoryContextualContentBatchPromotionRepository(),
    });
    expect(promoted.ok).toBe(false);
    if (promoted.ok) {
      throw new Error("promote should be refused");
    }
    expect(promoted.code).toBe("PROMOTION_WRITE_DISABLED");
    expect(await reviews.get(spec.reviewKey)).toEqual(stored);
  });

  it("refuses promote when promotion is disabled even if write is on", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const result = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: {
        ...REVIEW_WRITE,
        CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0",
        CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
        CONTEXTUAL_PROMOTION_RUNTIME: "memory",
      },
      reviewRepository: reviews,
      promotionRepository: new InMemoryContextualContentBatchPromotionRepository(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("promote should be refused");
    }
    expect(result.code).toBe("PROMOTION_DISABLED");
  });

  it("promotes when both promotion gates are on and readiness is met", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const promotions = new InMemoryContextualContentBatchPromotionRepository();
    const result = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: PROMOTION_WRITE,
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(result.ok).toBe(true);
  });

  it("returns different codes for feature-disabled and runtime-invalid", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const disabled = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: { CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0" },
      reviewRepository: reviews,
    });
    const invalid = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: {
        CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
        CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
        CONTEXTUAL_PROMOTION_RUNTIME: "maps",
      },
      reviewRepository: reviews,
    });
    expect(disabled.ok).toBe(false);
    expect(invalid.ok).toBe(false);
    if (disabled.ok || invalid.ok) {
      throw new Error("both should fail");
    }
    expect(disabled.code).toBe("PROMOTION_DISABLED");
    expect(invalid.code).toBe("PROMOTION_RUNTIME_INVALID");
    expect(disabled.code).not.toBe(invalid.code);
  });

  it("does not grant release publish and is not granted by the release write gate", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const promotions = new InMemoryContextualContentBatchPromotionRepository();
    const promotionOnly = {
      ...PROMOTION_WRITE,
      CONTEXTUAL_CONTENT_RELEASE_ENABLED: "0",
      CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "0",
    };
    expect(isContextualContentReleaseWriteEnabled(promotionOnly)).toBe(false);
    const promoted = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: promotionOnly,
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(promoted.ok).toBe(true);

    const releaseOnly = {
      DEBUG_TOOLS_ENABLED: "1",
      CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
      CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
      CONTEXTUAL_RELEASE_RUNTIME: "memory",
      CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0",
      CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "0",
    };
    expect(isContextualContentPromotionWriteEnabled(releaseOnly)).toBe(false);
    const releasePromote = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: releaseOnly,
      reviewRepository: reviews,
      promotionRepository: new InMemoryContextualContentBatchPromotionRepository(),
    });
    expect(releasePromote.ok).toBe(false);
    if (releasePromote.ok) {
      throw new Error("release gate must not grant promotion");
    }
    expect(releasePromote.code).toBe("PROMOTION_DISABLED");

    const draft = await createMealMigrationDraft({
      env: {
        ...PROMOTION_WRITE,
        CONTEXTUAL_CONTENT_RELEASE_ENABLED: "0",
        CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "0",
      },
      reviewRepository: reviews,
      promotionRepository: promotions,
      repository: new InMemoryContextualContentReleaseRepository(),
    });
    expect(draft.ok).toBe(false);
    if (draft.ok) {
      throw new Error("promotion must not grant release");
    }
    expect(draft.code).toBe("RELEASE_WRITE_DISABLED");
  });

  it("keeps the server action closed when the UI gate is off", async () => {
    const previous = {
      enabled: process.env.CONTEXTUAL_CONTENT_PROMOTION_ENABLED,
      write: process.env.CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED,
    };
    process.env.CONTEXTUAL_CONTENT_PROMOTION_ENABLED = "0";
    process.env.CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED = "0";
    try {
      const result = await promoteReviewedBatch({
        packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
        expectedRevision: 0,
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe("PROMOTION_DISABLED");
    } finally {
      if (previous.enabled === undefined) {
        delete process.env.CONTEXTUAL_CONTENT_PROMOTION_ENABLED;
      } else {
        process.env.CONTEXTUAL_CONTENT_PROMOTION_ENABLED = previous.enabled;
      }
      if (previous.write === undefined) {
        delete process.env.CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED;
      } else {
        process.env.CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED = previous.write;
      }
    }
    const actionSource = readFileSync("src/app/debug/contextual-content-review/actions.ts", "utf8");
    expect(actionSource).toContain("isContextualContentPromotionWriteEnabled");
    expect(actionSource).toMatch(
      /promoteReviewedBatch[\s\S]*isContextualContentPromotionEnabled[\s\S]*isContextualContentPromotionWriteEnabled/,
    );
    const promoteSource = readFileSync(
      "src/server/contextual-content-promotion/promote-contextual-content-batch.ts",
      "utf8",
    );
    expect(promoteSource).not.toContain("isContextualContentReviewWriteEnabled");
  });
});
