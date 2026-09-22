import { experimentalMealContextLabPack } from "@/contextual-learning/candidate-v0/content";
import { MEAL_MIGRATION_RELEASE_ID } from "@/contextual-learning/candidate-v0/release";
import { resolveContextLabContentSourceMode } from "@/server/context-lab/context-lab-content-source";
import { loadEffectiveSceneContentRegistry } from "@/server/contextual-content-promotion/load-effective-registry";
import { buildMealMigrationAuthority } from "./authority";
import { inspectMealReleaseEligibility } from "./inspect-release-eligibility";
import { createContextualReleaseRepository } from "./create-release-runtime";
import { isContextualContentReleaseWriteEnabled } from "./gates";
import type { ContextualContentReleaseRepository } from "./release-repository";
import type {
  ReleaseWorkspace,
  ReleaseWorkspaceCard,
  ReleaseWorkspaceTarget,
} from "./types";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import type { ContextualContentBatchPromotionRepository } from "@/server/contextual-content-promotion/promotion-repository";

function toWorkspaceTarget(
  entry: {
    reviewKey: string;
    packId: string;
    displayLabel: string;
    target: { lexemeId: string; senseId: string };
    contentFingerprint: string;
    reviewRevision: number;
    approvalBasis: string;
    selectedMeaning: string | null;
    humanDecision: string;
  },
): ReleaseWorkspaceTarget {
  return {
    reviewKey: entry.reviewKey,
    packId: entry.packId,
    displayLabel: entry.displayLabel,
    senseId: entry.target.senseId,
    lexemeId: entry.target.lexemeId,
    reviewSource:
      entry.approvalBasis === "HUMAN_REVIEW_PROMOTION"
        ? "HUMAN_REVIEW"
        : "LEGACY_EXPERIMENT_BASELINE",
    contentFingerprint: entry.contentFingerprint,
    reviewRevision: entry.reviewRevision,
    approvalBasis: entry.approvalBasis,
    selectedMeaning: entry.selectedMeaning,
    humanDecision: entry.humanDecision,
  };
}

export async function projectReleaseWorkspace(input: {
  env?: Record<string, string | undefined>;
  repository?: ContextualContentReleaseRepository;
  reviewRepository?: ContentReviewRepository;
  promotionRepository?: ContextualContentBatchPromotionRepository;
} = {}): Promise<ReleaseWorkspace> {
  const env = input.env ?? process.env;
  const loaded = await loadEffectiveSceneContentRegistry({
    env,
    reviewRepository: input.reviewRepository,
    promotionRepository: input.promotionRepository,
  });
  const authority = await buildMealMigrationAuthority({
    reviewRepository: input.reviewRepository,
    promotionRepository: input.promotionRepository,
    registry: loaded.registry,
  });
  const eligibility = await inspectMealReleaseEligibility({
    reviewRepository: input.reviewRepository,
    promotionRepository: input.promotionRepository,
    registry: loaded.registry,
  });
  if (!loaded.ok) {
    eligibility.eligibilityOk = false;
    eligibility.canCreateDraft = false;
    eligibility.issues = [
      {
        code: "RELEASE_PROMOTION_INVALID",
        path: "registry",
        detail: loaded.code
          ? `${loaded.code}: ${loaded.message ?? "Effective promotion registry is unavailable."}`
          : "Effective registry projection is fail-closed.",
      },
      ...eligibility.issues,
    ];
  }
  const repository = input.repository ?? createContextualReleaseRepository(env);
  const listed = await repository.list();
  const draft =
    listed.find((item) => item.status === "DRAFT" || item.status === "PREFLIGHT_VALIDATED") ??
    (await repository.get(MEAL_MIGRATION_RELEASE_ID));
  const pack = experimentalMealContextLabPack();
  const pointer = listed[0]
    ? await repository.getActivePointer(listed[0].sceneId)
    : await repository.getActivePointer("meal-scene-v0");
  const contentSource = resolveContextLabContentSourceMode(env);
  const activeLoaded = pointer ? await repository.loadActiveRelease(pointer.sceneId) : null;
  const releases: ReleaseWorkspaceCard[] = listed.map((item) => ({
    releaseId: item.releaseId,
    sceneId: item.sceneId,
    status: item.status,
    revision: item.revision,
    packFingerprint: item.packFingerprint,
    releaseFingerprint: item.releaseFingerprint,
    targetCount: item.targetEntries.length,
    approvalSummary: item.targetEntries
      .map((entry) => `${entry.displayLabel}:${entry.approvalBasis}`)
      .join(" · "),
    preflightOk:
      item.status === "PREFLIGHT_VALIDATED" || item.status === "PUBLISHED" || item.status === "SUPERSEDED"
        ? true
        : item.validationSummary
          ? item.validationSummary.ok
          : null,
    isActive:
      pointer?.releaseId === item.releaseId &&
      pointer.releaseFingerprint === item.releaseFingerprint,
    publishedAt: item.publishedAt,
    supersededAt: item.supersededAt,
    supersededByReleaseId: item.supersededByReleaseId,
  }));
  return {
    currentRuntime: {
      driver: contentSource === "active-release" ? "ACTIVE_RELEASE" : "CODE_DEFINED_BATCH_02",
      packId:
        contentSource === "active-release" && activeLoaded?.ok
          ? activeLoaded.release.packSnapshot.id
          : pack.id,
      publishedByReleasePipeline: contentSource === "active-release",
      contentSource,
      notice:
        contentSource === "active-release"
          ? "Context Lab 当前从服务端 active release 加载实验内容。这不会发布到 /train，不代表学习完成，也不修改 Evidence 或掌握度。"
          : "Context Lab 当前仍使用 static 六词实验 pack。发布只影响 active-release 模式。这不会发布到 /train。",
    },
    registry: loaded.registry.map((entry) => ({
      packId: entry.packId,
      status: entry.status,
      approvalBasis: entry.approvalBasis ?? null,
      parentPackId: entry.parentPackId ?? null,
      releaseEligibility: entry.releaseEligibility ?? "NONE",
    })),
    eligibility,
    liveTargets: authority.targetEntries.map(toWorkspaceTarget),
    draft,
    releases,
    activePointer: pointer,
    writeEnabled: isContextualContentReleaseWriteEnabled(env),
    preflight: {
      ok: draft?.status === "PREFLIGHT_VALIDATED" || draft?.status === "PUBLISHED" ? true : draft ? null : null,
      issues: draft?.validationSummary?.issues ? [...draft.validationSummary.issues] : [],
    },
    fingerprints: {
      packFingerprint: draft?.packFingerprint ?? pointer?.releaseFingerprint ?? null,
      contextModelFingerprint: draft?.contextModelFingerprint ?? null,
      releaseFingerprint: draft?.releaseFingerprint ?? pointer?.releaseFingerprint ?? null,
    },
  };
}
