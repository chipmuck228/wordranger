import { MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID } from "@/contextual-learning/candidate-v0/content";
import { InMemoryContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/in-memory-promotion-repository";
import { promoteContextualContentBatch } from "@/server/contextual-content-promotion/promote-contextual-content-batch";
import { createMealMigrationDraft } from "@/server/contextual-content-release/create-migration-draft";
import { InMemoryContextualContentReleaseRepository } from "@/server/contextual-content-release/in-memory-release-repository";
import type { ContextualContentReleaseRepository } from "@/server/contextual-content-release/release-repository";
import { preflightContextualContentRelease } from "@/server/contextual-content-release/preflight-contextual-content-release";
import { publishContextualContentRelease } from "@/server/contextual-content-release/publish-contextual-content-release";
import { loadContextLabContent } from "@/server/context-lab/context-lab-content-source";
import { MealContextLabController } from "@/server/context-lab/meal-context-lab-controller";
import { InMemoryContextLabRunRepository } from "@/server/context-lab/in-memory-context-lab-run-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import {
  approveBatch03Targets,
  tempReviewRepository,
  withFallbackReviews,
} from "../contextual-content-promotion/helpers";

export const BATCH_03_LAB_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_ENABLED: "1",
  CONTEXTUAL_CONTENT_PROMOTION_WRITE_ENABLED: "1",
  CONTEXTUAL_PROMOTION_RUNTIME: "memory",
  CONTEXTUAL_CONTENT_RELEASE_ENABLED: "1",
  CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED: "1",
  CONTEXTUAL_RELEASE_RUNTIME: "memory",
  CONTEXT_LAB_CONTENT_SOURCE: "active-release",
};

export async function publishSyntheticNineWordRelease() {
  const seeded = tempReviewRepository();
  await approveBatch03Targets(seeded);
  const reviews = withFallbackReviews(seeded);
  const promotions = new InMemoryContextualContentBatchPromotionRepository();
  const promoted = await promoteContextualContentBatch({
    packId: MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
    expectedRevision: 0,
    env: BATCH_03_LAB_ENV,
    reviewRepository: reviews,
    promotionRepository: promotions,
  });
  if (!promoted.ok) {
    throw new Error(promoted.message);
  }
  const releases = new InMemoryContextualContentReleaseRepository();
  const created = await createMealMigrationDraft({
    env: BATCH_03_LAB_ENV,
    repository: releases,
    reviewRepository: reviews,
    promotionRepository: promotions,
    now: "2026-09-22T08:00:00.000Z",
  });
  if (!created.ok) {
    throw new Error(`${created.code}: ${created.message}`);
  }
  const preflight = await preflightContextualContentRelease({
    env: BATCH_03_LAB_ENV,
    repository: releases,
    reviewRepository: reviews,
    promotionRepository: promotions,
    releaseId: created.record.releaseId,
    revision: created.record.revision,
  });
  if (!preflight.ok) {
    throw new Error(`${preflight.code}: ${preflight.message}`);
  }
  const published = await publishContextualContentRelease({
    env: BATCH_03_LAB_ENV,
    repository: releases,
    reviewRepository: reviews,
    promotionRepository: promotions,
    releaseId: preflight.record.releaseId,
    revision: preflight.record.revision,
    now: "2026-09-22T08:00:00.002Z",
  });
  if (!published.ok) {
    throw new Error(`${published.code}: ${published.message}`);
  }
  return {
    releases,
    reviews,
    promotions,
    published: published.record,
    pointer: published.pointer,
  };
}

export function createNineWordLabHarness(
  releases: ContextualContentReleaseRepository,
  env: Record<string, string | undefined> = BATCH_03_LAB_ENV,
) {
  const repository = new InMemoryContextLabRunRepository();
  const learningTasks = new InMemoryLearningTaskRepository();
  const learning = new InMemoryLearningRepository();
  let seq = 0;
  const controller = new MealContextLabController({
    repository,
    learningTasks,
    learning,
    userId: V1_PLACEHOLDER_USER_ID,
    beginAt: "PROBE",
    now: () => "2026-09-22T08:00:00.000Z",
    createId: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
    loadContent: (pin) =>
      loadContextLabContent({
        env,
        repository: releases,
        pin,
      }),
  });
  return { controller, repository, learningTasks, learning };
}
