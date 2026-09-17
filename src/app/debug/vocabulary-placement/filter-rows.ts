import type { PlacementReviewQuery, PlacementReviewRow } from "@/server/vocabulary/placement-review-snapshot";

export function filterPlacementReviewRows(
  rows: readonly PlacementReviewRow[],
  filters: PlacementReviewQuery,
): PlacementReviewRow[] {
  const needle = filters.query?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (filters.provisionalBand && row.provisionalBand !== filters.provisionalBand) {
      return false;
    }
    if (filters.effectiveBand && row.effectiveBand !== filters.effectiveBand) {
      return false;
    }
    if (filters.reviewStatus === "reviewed" && !row.reviewed) {
      return false;
    }
    if (filters.reviewStatus === "unreviewed" && row.reviewed) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return (
      row.lemma.toLowerCase().includes(needle) ||
      row.display.toLowerCase().includes(needle) ||
      row.canonicalKey.toLowerCase().includes(needle) ||
      row.lexemeId.toLowerCase().includes(needle) ||
      row.meaningsZh.some((meaning) => meaning.toLowerCase().includes(needle))
    );
  });
}
