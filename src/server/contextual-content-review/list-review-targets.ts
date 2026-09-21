import { fileContentReviewRepository } from "./file-content-review-repository";
import { currentContentFingerprint } from "./project-review-packet";
import { CONTENT_REVIEW_TARGETS, reviewHref } from "./review-target-registry";
import type { ContentReviewListItem } from "./types";

export async function listContentReviewTargets(): Promise<ContentReviewListItem[]> {
  const items: ContentReviewListItem[] = [];
  for (const spec of CONTENT_REVIEW_TARGETS) {
    const record = await fileContentReviewRepository.get(spec.reviewKey);
    const fingerprint = currentContentFingerprint(spec);
    const stale = Boolean(record && fingerprint && record.contentFingerprint !== fingerprint);
    items.push({
      reviewKey: spec.reviewKey,
      href: reviewHref(spec),
      title: spec.title,
      targetLabel: spec.target.senseId,
      statusLabel: stale
        ? "STALE_REVIEW"
        : record
          ? record.decision
          : "Candidate / 待人工审核",
      frameLabels: ["Home Breakfast", "Restaurant Meal"],
      registryStatus: "CANDIDATE",
    });
  }
  return items;
}
