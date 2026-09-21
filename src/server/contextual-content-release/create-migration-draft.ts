import "server-only";

import { isContextualContentReleaseWriteEnabled } from "./gates";
import { buildMealMigrationAuthority, manifestFromAuthority } from "./authority";
import type { ContextualContentReleaseRepository } from "./release-repository";
import { createContextualReleaseRepository } from "./create-release-runtime";
import type { ReleaseSaveResult } from "./types";
import { RELEASE_ACTOR_ID } from "./types";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import type {
  ContextualSceneContentPack,
  SceneLexemeLoader,
} from "@/contextual-learning/candidate-v0/content/types";

export async function createMealMigrationDraft(input: {
  env?: Record<string, string | undefined>;
  now?: string;
  repository?: ContextualContentReleaseRepository;
  reviewRepository?: ContentReviewRepository;
  loadLexeme?: SceneLexemeLoader;
  pack?: ContextualSceneContentPack;
} = {}): Promise<ReleaseSaveResult> {
  if (!isContextualContentReleaseWriteEnabled(input.env)) {
    return {
      ok: false,
      code: "RELEASE_WRITE_DISABLED",
      message: "Release writes are disabled.",
    };
  }
  const authority = await buildMealMigrationAuthority({
    reviewRepository: input.reviewRepository,
    loadLexeme: input.loadLexeme,
    pack: input.pack,
  });
  const blocking = authority.issues.filter(
    (item) =>
      item.code === "RELEASE_REVIEW_MISSING" ||
      item.code === "RELEASE_REVIEW_STALE" ||
      item.code === "RELEASE_FINGERPRINT_DRIFT" ||
      item.code === "RELEASE_SENSE_UNRESOLVED" ||
      item.code === "RELEASE_REVIEW_INVALID" ||
      item.code === "RELEASE_LEGACY_FORGED",
  );
  if (blocking.length > 0 || authority.targetEntries.length !== 6) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: blocking[0]?.detail ?? "Migration draft requires an approval-bound six-word snapshot.",
    };
  }
  const record = manifestFromAuthority({
    authority,
    createdAt: input.now ?? new Date().toISOString(),
    createdBy: RELEASE_ACTOR_ID,
  });
  const repository = input.repository ?? createContextualReleaseRepository(input.env);
  return repository.create({ record });
}
