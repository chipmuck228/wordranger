import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { currentContentFingerprint } from "@/server/contextual-content-review/project-review-packet";
import { CONTENT_REVIEW_TARGETS } from "@/server/contextual-content-review/review-target-registry";
import { saveContentReviewDecision } from "@/server/contextual-content-review/save-review-decision";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import {
  FileContentReviewRepository,
  fileContentReviewRepository,
} from "@/server/contextual-content-review/file-content-review-repository";

const WRITE_ENV = {
  DEBUG_TOOLS_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_ENABLED: "1",
  CONTEXTUAL_CONTENT_REVIEW_WRITE_ENABLED: "1",
};

export function tempReviewRepository() {
  const dir = mkdtempSync(path.join(tmpdir(), "batch-promo-review-"));
  return new FileContentReviewRepository((reviewKey) =>
    path.join(dir, reviewKey, "human-review.record.json"),
  );
}

export function withFallbackReviews(
  primary: ContentReviewRepository,
  fallback: ContentReviewRepository = fileContentReviewRepository,
): ContentReviewRepository {
  return {
    get: async (reviewKey) => (await primary.get(reviewKey)) ?? fallback.get(reviewKey),
    saveIfRevision: (input) => primary.saveIfRevision(input),
    commit: (input) => primary.commit(input),
  };
}

export async function approveBatch03Targets(
  repository: FileContentReviewRepository,
  slugs: readonly string[] = ["knife", "bread", "water"],
) {
  for (const slug of slugs) {
    const spec = CONTENT_REVIEW_TARGETS.find((item) => item.targetSlug === slug)!;
    const fingerprint = currentContentFingerprint(spec)!;
    const saved = await saveContentReviewDecision({
      fingerprint,
      revision: 0,
      decision: "APPROVED",
      notes: [],
      env: WRITE_ENV,
      repository,
      syncMarkdown: false,
    });
    if (!saved.ok) {
      throw new Error(saved.message);
    }
  }
}
