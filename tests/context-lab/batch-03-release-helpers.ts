import { MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID } from "@/contextual-learning/candidate-v0/content";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import {
  fingerprintsForManifest,
  MEAL_RELEASE_SCENE_ID,
  type ContextualContentReleaseManifest,
} from "@/contextual-learning/candidate-v0/release";
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

export const SNAPSHOT_A_LABELS = {
  knife: "A版小刀标",
  bread: "A版面包标",
  water: "A版水标",
} as const;

export const SNAPSHOT_B_LABELS = {
  knife: "B版小刀标",
  bread: "B版面包标",
  water: "B版水标",
} as const;

export const SNAPSHOT_A_CAPTIONS = {
  knife: "A版小刀关系说明",
  bread: "A版面包对比说明",
  water: "A版水关系说明",
} as const;

export const SNAPSHOT_B_CAPTIONS = {
  knife: "B版小刀关系说明",
  bread: "B版面包对比说明",
  water: "B版水关系说明",
} as const;

function relabelNineWordPack(
  pack: ContextualSceneContentPack,
  labels: { knife: string; bread: string; water: string },
  captions: { knife: string; bread: string; water: string },
): ContextualSceneContentPack {
  const clone = structuredClone(pack);
  for (const lexeme of clone.lexemes) {
    const token = lexeme.membership.presentationToken;
    if (token !== "knife" && token !== "bread" && token !== "water") {
      continue;
    }
    lexeme.lexicalPresentation.displayLabel = labels[token];
    for (const group of lexeme.grounding.frameFacts) {
      for (const fact of group.facts) {
        if (fact.caption) {
          fact.caption = captions[token];
        }
      }
    }
    for (const contrast of lexeme.contrastBindings) {
      if (contrast.caption) {
        contrast.caption = captions[token];
      }
    }
  }
  return clone;
}

export function labeledReleaseFromPublished(
  source: ContextualContentReleaseManifest,
  input: {
    releaseId: string;
    labels: { knife: string; bread: string; water: string };
    captions: { knife: string; bread: string; water: string };
    status?: ContextualContentReleaseManifest["status"];
    supersededByReleaseId?: string | null;
  },
): ContextualContentReleaseManifest {
  const next = structuredClone(source);
  next.releaseId = input.releaseId;
  next.packSnapshot = relabelNineWordPack(source.packSnapshot, input.labels, input.captions);
  next.targetEntries = next.targetEntries.map((entry) => {
    const token = next.packSnapshot.lexemes.find(
      (lexeme) =>
        lexeme.target.lexemeId === entry.target.lexemeId &&
        lexeme.target.senseId === entry.target.senseId,
    )?.membership.presentationToken;
    if (token !== "knife" && token !== "bread" && token !== "water") {
      return entry;
    }
    return { ...entry, displayLabel: input.labels[token] };
  });
  next.status = input.status ?? "PUBLISHED";
  next.supersededByReleaseId = input.supersededByReleaseId ?? null;
  next.supersededAt = input.status === "SUPERSEDED" ? "2026-09-22T09:00:00.000Z" : null;
  const prints = fingerprintsForManifest(next);
  next.packFingerprint = prints.packFingerprint;
  next.contextModelFingerprint = prints.contextModelFingerprint;
  next.releaseFingerprint = prints.releaseFingerprint;
  return next;
}

export function installActiveRelease(
  repository: InMemoryContextualContentReleaseRepository,
  release: ContextualContentReleaseManifest,
  pointerRevision = 1,
) {
  repository.replaceRaw(release);
  repository.replacePointerRaw({
    schemaVersion: release.schemaVersion,
    kind: "CANDIDATE_V0_ACTIVE_RELEASE_POINTER",
    sceneId: MEAL_RELEASE_SCENE_ID,
    releaseId: release.releaseId,
    releaseFingerprint: release.releaseFingerprint,
    revision: pointerRevision,
    activatedAt: "2026-09-22T08:30:00.000Z",
    activatedBy: "test-actor",
  });
}
