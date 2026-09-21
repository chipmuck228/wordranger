import {
  experimentalMealContextLabPack,
  listSceneContentRegistry,
} from "@/contextual-learning/candidate-v0/content";
import { MEAL_MIGRATION_RELEASE_ID } from "@/contextual-learning/candidate-v0/release";
import { buildMealMigrationAuthority } from "./authority";
import { createContextualReleaseRepository } from "./create-release-runtime";
import { isContextualContentReleaseWriteEnabled } from "./gates";
import type { ContextualContentReleaseRepository } from "./release-repository";
import type { ReleaseWorkspace, ReleaseWorkspaceTarget } from "./types";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";

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
} = {}): Promise<ReleaseWorkspace> {
  const authority = await buildMealMigrationAuthority({
    reviewRepository: input.reviewRepository,
  });
  const repository = input.repository ?? createContextualReleaseRepository(input.env);
  const draft = await repository.get(MEAL_MIGRATION_RELEASE_ID);
  const pack = experimentalMealContextLabPack();
  return {
    currentRuntime: {
      driver: "CODE_DEFINED_BATCH_02",
      packId: pack.id,
      publishedByReleasePipeline: false,
      notice:
        "当前仍由 code-defined batch 02 驱动。尚未由 Release Pipeline 发布。本阶段只验证发布快照，不会切换 Context Lab。",
    },
    registry: listSceneContentRegistry().map((entry) => ({
      packId: entry.packId,
      status: entry.status,
      approvalBasis: entry.approvalBasis ?? null,
    })),
    liveTargets: authority.targetEntries.map(toWorkspaceTarget),
    draft,
    writeEnabled: isContextualContentReleaseWriteEnabled(input.env),
    preflight: {
      ok: draft?.status === "PREFLIGHT_VALIDATED" ? true : draft ? null : null,
      issues: draft?.validationSummary?.issues ? [...draft.validationSummary.issues] : [],
    },
    fingerprints: {
      packFingerprint: draft?.packFingerprint ?? null,
      contextModelFingerprint: draft?.contextModelFingerprint ?? null,
      releaseFingerprint: draft?.releaseFingerprint ?? null,
    },
  };
}
