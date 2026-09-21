/**
 * Review artifact paths are derived from the registered review key.
 * Clients cannot choose a filesystem path.
 */

import path from "node:path";
import { reviewTargetByKey } from "./review-target-registry";

export function safeReviewArtifactDirectory(reviewKey: string): string | null {
  const spec = reviewTargetByKey(reviewKey);
  if (!spec) {
    return null;
  }
  const root = path.resolve(process.cwd(), "docs/contextual-content-reviews");
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
