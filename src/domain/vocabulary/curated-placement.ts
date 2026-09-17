/**
 * Human-reviewed placement overrides. Vocabulary Domain reference data.
 *
 * Separate from provisional suggestions. Never stored on StudentLexemeModel,
 * LearningEvidence, learning_tasks, or game_sessions.
 */

export const CURATED_PLACEMENT_VERSION = "curated-v1";
export const HUMAN_REVIEW_PROVENANCE = "wordranger-human-review/v1";
export const CURATED_PLACEMENT_STATUS = "REVIEWED";

export type CuratedPlacementStatus = typeof CURATED_PLACEMENT_STATUS;
export type EffectivePlacementOrigin = "CURATED" | "PROVISIONAL";

export interface CuratedPlacementOverride {
  lexemeId: string;
  bandId: string;
  status: CuratedPlacementStatus;
  source: "CURATED";
  provenance: string[];
  reviewedAt: string;
  reviewNote?: string;
}

export interface CuratedWordPlacementFile {
  version: string;
  records: CuratedPlacementOverride[];
}

export interface EffectivePlacement {
  lexemeId: string;
  bandId: string;
  origin: EffectivePlacementOrigin;
  provenance: string[];
}

export interface PlacementReviewCoverage {
  totalLexemes: number;
  provisionalCount: number;
  reviewedCount: number;
  reviewedCoverage: number;
  unreviewedCount: number;
  reviewedBandCounts: Record<string, number>;
}

export function cloneCuratedOverride(
  record: CuratedPlacementOverride,
): CuratedPlacementOverride {
  const cloned: CuratedPlacementOverride = {
    lexemeId: record.lexemeId,
    bandId: record.bandId,
    status: record.status,
    source: "CURATED",
    provenance: [...record.provenance],
    reviewedAt: record.reviewedAt,
  };
  if (record.reviewNote !== undefined) {
    cloned.reviewNote = record.reviewNote;
  }
  return cloned;
}

export function serializeCuratedWordPlacementFile(
  file: CuratedWordPlacementFile,
): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
