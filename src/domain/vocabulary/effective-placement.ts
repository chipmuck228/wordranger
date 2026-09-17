import type { CuratedPlacementOverride } from "./curated-placement";
import type { EffectivePlacement } from "./curated-placement";
import type { PlacementReviewCoverage } from "./curated-placement";
import { orderedPlacementBands } from "./provisional-placement";
import type { PlacementBandDefinition } from "./provisional-placement";
import type { ProvisionalLexemePlacement } from "./provisional-placement";

/**
 * Review/admin merge only. Scheduler and Daily Training must not call this.
 */
export function mergeEffectivePlacements(
  provisional: readonly ProvisionalLexemePlacement[],
  curated: readonly CuratedPlacementOverride[],
): EffectivePlacement[] {
  const overrideByLexeme = new Map(
    curated.map((record) => [record.lexemeId, record]),
  );
  return provisional.map((record) => {
    const override = overrideByLexeme.get(record.lexemeId);
    if (override) {
      return {
        lexemeId: record.lexemeId,
        bandId: override.bandId,
        origin: "CURATED",
        provenance: [...override.provenance],
      };
    }
    return {
      lexemeId: record.lexemeId,
      bandId: record.provisionalBand.value,
      origin: "PROVISIONAL",
      provenance: [...record.provisionalBand.provenance],
    };
  });
}

export function summarizePlacementReview(args: {
  definition: PlacementBandDefinition;
  totalLexemes: number;
  provisionalCount: number;
  curated: readonly CuratedPlacementOverride[];
  lexemeIds: ReadonlySet<string>;
}): PlacementReviewCoverage {
  const reviewedBandCounts: Record<string, number> = {};
  for (const band of orderedPlacementBands(args.definition)) {
    reviewedBandCounts[band.id] = 0;
  }
  const reviewed = new Set<string>();
  for (const record of args.curated) {
    if (!args.lexemeIds.has(record.lexemeId)) {
      continue;
    }
    reviewed.add(record.lexemeId);
    reviewedBandCounts[record.bandId] =
      (reviewedBandCounts[record.bandId] ?? 0) + 1;
  }
  const reviewedCount = reviewed.size;
  return {
    totalLexemes: args.totalLexemes,
    provisionalCount: args.provisionalCount,
    reviewedCount,
    reviewedCoverage:
      args.totalLexemes === 0 ? 0 : reviewedCount / args.totalLexemes,
    unreviewedCount: Math.max(0, args.totalLexemes - reviewedCount),
    reviewedBandCounts,
  };
}
