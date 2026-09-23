/**
 * Review artifact paths are derived from the registered review key.
 * Clients cannot choose a filesystem path.
 *
 * Ordinary tests may redirect the root with CONTEXTUAL_CONTENT_REVIEW_ROOT.
 * That override does not change review semantics; it only relocates the
 * file store. Production defaults remain docs/contextual-content-reviews.
 */

import path from "node:path";
import { reviewTargetByKey } from "./review-target-registry";

export function defaultContextualReviewRoot(cwd = process.cwd()): string {
  return path.resolve(cwd, "docs/contextual-content-reviews");
}

export function resolveContextualReviewRoot(
  env: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
): string {
  const override = env.CONTEXTUAL_CONTENT_REVIEW_ROOT?.trim();
  return override ? path.resolve(override) : defaultContextualReviewRoot(cwd);
}

export function safeReviewArtifactDirectory(
  reviewKey: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const spec = reviewTargetByKey(reviewKey);
  if (!spec) {
    return null;
  }
  const root = resolveContextualReviewRoot(env);
  const dir = path.resolve(root, spec.reviewKey);
  const relative = path.relative(root, dir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  if (path.basename(dir) !== spec.reviewKey) {
    return null;
  }
  return dir;
}

export function safeReviewRecordPath(reviewKey: string): string | null {
  const dir = safeReviewArtifactDirectory(reviewKey);
  return dir ? path.join(dir, "human-review.record.json") : null;
}

export function safeReviewMarkdownPath(reviewKey: string): string | null {
  const dir = safeReviewArtifactDirectory(reviewKey);
  return dir ? path.join(dir, "HUMAN_REVIEW.md") : null;
}
