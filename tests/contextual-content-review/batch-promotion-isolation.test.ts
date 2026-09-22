import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
  experimentalMealContextLabPack,
  getApprovedExperimentSceneContent,
  listSceneContentRegistry,
} from "@/contextual-learning/candidate-v0/content";
import { inspectMealReleaseEligibility } from "@/server/contextual-content-release/inspect-release-eligibility";
import { InMemoryContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/in-memory-promotion-repository";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

describe("batch promotion isolation", () => {
  it("does not change authored registry, static Context Lab, or /train", async () => {
    expect(listSceneContentRegistry().find((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)).toMatchObject({
      status: "CANDIDATE",
      releaseEligibility: "NONE",
    });
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID).ok).toBe(false);
    expect(experimentalMealContextLabPack().lexemes).toHaveLength(6);
    const eligibility = await inspectMealReleaseEligibility({
      promotionRepository: new InMemoryContextualContentBatchPromotionRepository(),
    });
    expect(eligibility.packId).toBe("meal-scene-expansion-batch-02");
    expect(eligibility.targetCount).toBe(6);
    expect(eligibility.unpromotedCandidates.some((item) => item.packId === MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)).toBe(
      true,
    );
    for (const file of walk("src/app/train")) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("promoteContextualContentBatch");
      expect(source, file).not.toContain("CONTEXTUAL_CONTENT_BATCH_PROMOTION");
    }
    const promote = readFileSync("src/server/contextual-content-promotion/promote-contextual-content-batch.ts", "utf8");
    expect(promote).not.toContain("processEvidence");
    expect(promote).not.toContain("LearningEvidence");
    expect(promote).not.toContain("publishContextualContentRelease");
    expect(promote).not.toContain("isContextualContentReviewWriteEnabled");
    const factory = readFileSync("src/server/contextual-content-promotion/create-promotion-runtime.ts", "utf8");
    expect(factory).toContain('mode === "supabase"');
    expect(factory).toContain("SupabaseContextualContentBatchPromotionRepository");
    expect(factory).toContain("createSupabaseServiceRoleClient");
  });
});
