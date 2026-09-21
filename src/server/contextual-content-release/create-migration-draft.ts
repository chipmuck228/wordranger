import "server-only";

import { isContextualContentReleaseWriteEnabled } from "./gates";
import { buildMealMigrationAuthority, manifestFromAuthority } from "./authority";
import type { ContextualContentReleaseRepository } from "./release-repository";
import { createContextualReleaseRepository } from "./create-release-runtime";
import type { ReleaseSaveResult } from "./types";
import { RELEASE_ACTOR_ID } from "./types";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import type { SceneLexemeLoader } from "@/contextual-learning/candidate-v0/content/types";

export async function createMealMigrationDraft(input: {
  env?: Record<string, string | undefined>;
  now?: string;
  repository?: ContextualContentReleaseRepository;
  reviewRepository?: ContentReviewRepository;
  loadLexeme?: SceneLexemeLoader;
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
  });
  if (authority.targetEntries.length !== 6) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: "Migration draft requires the current six-word snapshot.",
    };
  }
  const blocking = authority.issues.filter(
    (item) =>
      item.code === "RELEASE_REVIEW_MISSING" ||
      item.code === "RELEASE_REVIEW_STALE" ||
      item.code === "RELEASE_SENSE_UNRESOLVED",
  );
  if (blocking.length > 0) {
    return {
      ok: false,
      code: "RELEASE_INVALID",
      message: blocking[0]!.detail,
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
