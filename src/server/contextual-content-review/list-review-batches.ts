import { registryEntryFor } from "@/contextual-learning/candidate-v0/content";
import { listContentReviewTargets } from "./list-review-targets";
import { CONTENT_REVIEW_BLOCKED_CANDIDATES, CONTENT_REVIEW_TARGETS } from "./review-target-registry";
import type { ContentReviewBatchSummary } from "./types";

function batchTitle(batchId: string): string {
  const first = CONTENT_REVIEW_TARGETS.find((item) => item.batchId === batchId);
  return first?.title.replace(/\s·\s.+$/, "") ?? batchId;
}

export async function listContentReviewBatches(): Promise<ContentReviewBatchSummary[]> {
  const items = await listContentReviewTargets();
  const batchIds = [...new Set(CONTENT_REVIEW_TARGETS.map((item) => item.batchId))];
  return batchIds.map((batchId) => {
    const targets = items.filter((item) => item.batchId === batchId);
    const blockedCandidates = CONTENT_REVIEW_BLOCKED_CANDIDATES.filter(
      (item) => item.batchId === batchId,
    );
    const packId = CONTENT_REVIEW_TARGETS.find((item) => item.batchId === batchId)?.packId ?? "";
    const entry = packId ? registryEntryFor(packId) : null;
    const pending = targets.filter((item) => item.statusLabel === "PENDING").length;
    const approved = targets.filter((item) => item.statusLabel === "APPROVED").length;
    const rejected = targets.filter((item) => item.statusLabel === "REJECTED").length;
    const stale = targets.filter((item) => item.statusLabel === "STALE_REVIEW").length;
    const reviewCompleteUnpromoted =
      targets.length > 0 &&
      approved === targets.length &&
      stale === 0 &&
      entry?.status === "CANDIDATE" &&
      entry.releaseEligibility === "NONE";
    return {
      batchId,
      title: batchTitle(batchId),
      packId,
      registryStatus: entry?.status ?? "DRAFT",
      releaseEligibility: entry?.releaseEligibility ?? "NONE",
      totalAuthored: targets.length,
      pending,
      approved,
      rejected,
      stale,
      blocked: blockedCandidates.length,
      reviewCompleteUnpromoted,
      targets,
      blockedCandidates: blockedCandidates.map((item) => ({
        batchId: item.batchId,
        plannedLemma: item.plannedLemma,
        reason: item.reason,
      })),
    };
  });
}
