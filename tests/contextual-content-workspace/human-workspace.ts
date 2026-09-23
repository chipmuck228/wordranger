import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defaultContextualPromotionRoot } from "@/server/contextual-content-promotion/promotion-artifact-path";
import { defaultContextualReleaseRoot } from "@/server/contextual-content-release/release-artifact-path";
import { defaultContextualReviewRoot } from "@/server/contextual-content-review/review-artifact-path";

export const HUMAN_WORKSPACE_PATHS = {
  pointer: "docs/contextual-content-releases/pointer-meal-scene-v0.json",
  manifest: "docs/contextual-content-releases/meal-release-migration-v0.json",
  cupReview: "docs/contextual-content-reviews/meal-expansion-batch-01-cup/HUMAN_REVIEW.md",
  cupRecord:
    "docs/contextual-content-reviews/meal-expansion-batch-01-cup/human-review.record.json",
  plateReview: "docs/contextual-content-reviews/meal-expansion-batch-02-plate/HUMAN_REVIEW.md",
  plateRecord:
    "docs/contextual-content-reviews/meal-expansion-batch-02-plate/human-review.record.json",
  knifeReview: "docs/contextual-content-reviews/meal-expansion-batch-03-knife/HUMAN_REVIEW.md",
  knifeRecord:
    "docs/contextual-content-reviews/meal-expansion-batch-03-knife/human-review.record.json",
  breadReview: "docs/contextual-content-reviews/meal-expansion-batch-03-bread/HUMAN_REVIEW.md",
  breadRecord:
    "docs/contextual-content-reviews/meal-expansion-batch-03-bread/human-review.record.json",
  waterReview: "docs/contextual-content-reviews/meal-expansion-batch-03-water/HUMAN_REVIEW.md",
  waterRecord:
    "docs/contextual-content-reviews/meal-expansion-batch-03-water/human-review.record.json",
  batch03Promotion:
    "docs/contextual-content-promotions/meal-scene-v0__meal-scene-expansion-batch-03.json",
} as const;

export const HISTORICALLY_MISSING_HUMAN_PATHS = [
  HUMAN_WORKSPACE_PATHS.knifeReview,
  HUMAN_WORKSPACE_PATHS.knifeRecord,
  HUMAN_WORKSPACE_PATHS.breadReview,
  HUMAN_WORKSPACE_PATHS.breadRecord,
  HUMAN_WORKSPACE_PATHS.waterReview,
  HUMAN_WORKSPACE_PATHS.waterRecord,
  HUMAN_WORKSPACE_PATHS.batch03Promotion,
] as const;

export function humanWorkspaceRoots(cwd = process.cwd()): {
  cwd: string;
  docs: string;
  review: string;
  promotion: string;
  release: string;
} {
  return {
    cwd: path.resolve(cwd),
    docs: path.resolve(cwd, "docs"),
    review: defaultContextualReviewRoot(cwd),
    promotion: defaultContextualPromotionRoot(cwd),
    release: defaultContextualReleaseRoot(cwd),
  };
}

export function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function inventoryHumanArtifacts(cwd = process.cwd()): {
  present: Array<{ path: string; sha256: string }>;
  missing: string[];
} {
  const present: Array<{ path: string; sha256: string }> = [];
  const missing: string[] = [];
  for (const rel of Object.values(HUMAN_WORKSPACE_PATHS)) {
    const absolute = path.resolve(cwd, rel);
    if (!existsSync(absolute)) {
      missing.push(rel);
      continue;
    }
    present.push({ path: rel, sha256: sha256File(absolute) });
  }
  return { present, missing };
}
