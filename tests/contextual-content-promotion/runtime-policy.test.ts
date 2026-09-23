import { afterEach, describe, expect, it } from "vitest";
import {
  createContextualPromotionRepository,
  resetMemoryContextualPromotionRepositoryForTests,
} from "@/server/contextual-content-promotion/create-promotion-runtime";
import { FileContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/file-promotion-repository";
import { InMemoryContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/in-memory-promotion-repository";
import { loadEffectiveSceneContentRegistry } from "@/server/contextual-content-promotion/load-effective-registry";
import { promoteContextualContentBatch } from "@/server/contextual-content-promotion/promote-contextual-content-batch";
import { contextualPromotionRoot } from "@/server/contextual-content-promotion/promotion-artifact-path";
import {
  ContextualPromotionRuntimeError,
  resolveContextualPromotionRuntimeMode,
} from "@/server/contextual-content-promotion/runtime-mode";
import { SupabaseContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/supabase-promotion-repository";
import { MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID } from "@/contextual-learning/candidate-v0/content";
import { inspectMealReleaseEligibility } from "@/server/contextual-content-release/inspect-release-eligibility";
import { approveBatch03Targets, tempReviewRepository } from "./helpers";

afterEach(() => {
  resetMemoryContextualPromotionRepositoryForTests();
});

const WRITE = {
  CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
};

describe("contextual promotion runtime policy", () => {
  it("selects memory, file, and supabase only when configured explicitly", () => {
    const memory = createContextualPromotionRepository({ CONTEXTUAL_PROMOTION_RUNTIME: "memory" });
    expect(memory).toBeInstanceOf(InMemoryContextualContentBatchPromotionRepository);
    const again = createContextualPromotionRepository({ CONTEXTUAL_PROMOTION_RUNTIME: "memory" });
    expect(again).toBe(memory);

    const file = createContextualPromotionRepository({ CONTEXTUAL_PROMOTION_RUNTIME: "file" });
    expect(file).toBeInstanceOf(FileContextualContentBatchPromotionRepository);
    expect((file as FileContextualContentBatchPromotionRepository).artifactRoot).toBe(
      contextualPromotionRoot(),
    );

    const supabase = createContextualPromotionRepository({
      CONTEXTUAL_PROMOTION_RUNTIME: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    });
    expect(supabase).toBeInstanceOf(SupabaseContextualContentBatchPromotionRepository);
    expect(supabase).not.toBeInstanceOf(FileContextualContentBatchPromotionRepository);
    expect(supabase).not.toBeInstanceOf(InMemoryContextualContentBatchPromotionRepository);
  });

  it("fails closed for missing and invalid runtimes", () => {
    expect(() => resolveContextualPromotionRuntimeMode({})).toThrow(ContextualPromotionRuntimeError);
    try {
      resolveContextualPromotionRuntimeMode({});
    } catch (error) {
      expect(error).toBeInstanceOf(ContextualPromotionRuntimeError);
      if (error instanceof ContextualPromotionRuntimeError) {
        expect(error.code).toBe("PROMOTION_RUNTIME_MISSING");
      }
    }
    try {
      createContextualPromotionRepository({ CONTEXTUAL_PROMOTION_RUNTIME: "maps" });
    } catch (error) {
      expect(error).toBeInstanceOf(ContextualPromotionRuntimeError);
      if (error instanceof ContextualPromotionRuntimeError) {
        expect(error.code).toBe("PROMOTION_RUNTIME_INVALID");
      }
    }
    expect(() =>
      createContextualPromotionRepository({
        CONTEXTUAL_RELEASE_RUNTIME: "file",
        CONTEXT_LAB_RUNTIME: "memory",
      }),
    ).toThrow(/CONTEXTUAL_PROMOTION_RUNTIME/);
  });

  it("rejects memory and file on Vercel production and preview", () => {
    for (const vercelEnv of ["production", "preview"] as const) {
      for (const runtime of ["memory", "file"] as const) {
        try {
          resolveContextualPromotionRuntimeMode({
            CONTEXTUAL_PROMOTION_RUNTIME: runtime,
            VERCEL_ENV: vercelEnv,
          });
          throw new Error(`should reject ${runtime} on ${vercelEnv}`);
        } catch (error) {
          expect(error).toBeInstanceOf(ContextualPromotionRuntimeError);
          if (error instanceof ContextualPromotionRuntimeError) {
            expect(error.code).toBe("PROMOTION_RUNTIME_FORBIDDEN");
          }
        }
      }
    }
  });

  it("rejects supabase without service-role config and does not fall back to file", () => {
    try {
      createContextualPromotionRepository({ CONTEXTUAL_PROMOTION_RUNTIME: "supabase" });
      throw new Error("should have failed closed");
    } catch (error) {
      expect(error).toBeInstanceOf(ContextualPromotionRuntimeError);
      if (error instanceof ContextualPromotionRuntimeError) {
        expect(error.code).toBe("PROMOTION_RUNTIME_INVALID");
        expect(error.message).toMatch(/does not fall back to file or memory/);
      }
    }
  });

  it("does not read process runtime when a repository is injected", async () => {
    const reviews = tempReviewRepository();
    await approveBatch03Targets(reviews);
    const promotions = new InMemoryContextualContentBatchPromotionRepository();
    const promoted = await promoteContextualContentBatch({
      packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
      expectedRevision: 0,
      env: WRITE,
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(promoted.ok).toBe(true);
    const loaded = await loadEffectiveSceneContentRegistry({
      env: {},
      reviewRepository: reviews,
      promotionRepository: promotions,
    });
    expect(loaded.ok).toBe(true);
    expect(loaded.activatedPackId).toBe(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID);
  });

  it("distinguishes feature-disabled authored fallback from runtime-invalid fail-closed", async () => {
    const disabled = await loadEffectiveSceneContentRegistry({
      env: { CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "0" },
    });
    expect(disabled.ok).toBe(true);
    expect(disabled.code).toBeUndefined();
    expect(disabled.activatedPackId).toBeNull();

    const invalid = await loadEffectiveSceneContentRegistry({
      env: {
        CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
        CONTEXTUAL_PROMOTION_RUNTIME: "maps",
      },
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.code).toBe("PROMOTION_RUNTIME_INVALID");

    const missing = await loadEffectiveSceneContentRegistry({
      env: { CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1" },
    });
    expect(missing.ok).toBe(false);
    expect(missing.code).toBe("PROMOTION_RUNTIME_MISSING");

    const inspection = await inspectMealReleaseEligibility({
      env: { CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1" },
    });
    expect(inspection.eligibilityOk).toBe(false);
    expect(inspection.canCreateDraft).toBe(false);
    expect(inspection.issues[0]?.code).toBe("RELEASE_PROMOTION_INVALID");
    expect(inspection.issues[0]?.detail).toMatch(/PROMOTION_RUNTIME_MISSING/);
  });
});
