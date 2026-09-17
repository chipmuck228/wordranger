import {
  CURATED_PLACEMENT_STATUS,
  cloneCuratedOverride,
  type CuratedPlacementOverride,
} from "@/domain/vocabulary/curated-placement";

export const VOCABULARY_PLACEMENT_REVIEWS_TABLE =
  "vocabulary_placement_reviews";

export const VOCABULARY_PLACEMENT_REVIEW_COLUMNS =
  "lexeme_id, band_id, status, source, provenance, review_note, reviewed_at, updated_at";

export interface VocabularyPlacementReviewRow {
  lexeme_id: string;
  band_id: string;
  status: string;
  source: string;
  provenance: unknown;
  review_note: string | null;
  reviewed_at: string;
  updated_at?: string;
}

export function toVocabularyPlacementReviewRow(
  record: CuratedPlacementOverride,
  updatedAt = new Date().toISOString(),
): VocabularyPlacementReviewRow {
  return {
    lexeme_id: record.lexemeId,
    band_id: record.bandId,
    status: CURATED_PLACEMENT_STATUS,
    source: "CURATED",
    provenance: [...record.provenance],
    review_note: record.reviewNote ?? null,
    reviewed_at: record.reviewedAt,
    updated_at: updatedAt,
  };
}

export function mapVocabularyPlacementReviewRow(
  row: VocabularyPlacementReviewRow,
): CuratedPlacementOverride {
  if (!row || typeof row !== "object") {
    throw new Error("Curated placement row is missing");
  }
  const provenance = normalizeProvenance(row.provenance);
  const reviewedAt = normalizeReviewedAt(row.reviewed_at);
  if (row.source !== "CURATED") {
    throw new Error(
      `Curated placement row for ${row.lexeme_id} must be CURATED`,
    );
  }
  if (row.status !== CURATED_PLACEMENT_STATUS) {
    throw new Error(
      `Curated placement row for ${row.lexeme_id} must be REVIEWED`,
    );
  }
  if (!row.lexeme_id || !row.band_id) {
    throw new Error("Curated placement row is missing lexeme_id or band_id");
  }
  const record: CuratedPlacementOverride = {
    lexemeId: row.lexeme_id,
    bandId: row.band_id,
    status: CURATED_PLACEMENT_STATUS,
    source: "CURATED",
    provenance,
    reviewedAt,
  };
  if (row.review_note) {
    record.reviewNote = row.review_note;
  }
  return cloneCuratedOverride(record);
}

function normalizeProvenance(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Curated placement provenance must be a non-empty array");
  }
  const provenance = value.map((item) => String(item).trim());
  if (provenance.some((item) => !item)) {
    throw new Error("Curated placement provenance contains an empty value");
  }
  return provenance;
}

function normalizeReviewedAt(value: string): string {
  const parsed = Date.parse(value);
  if (!value || Number.isNaN(parsed)) {
    throw new Error(`Curated placement reviewed_at is malformed: ${String(value)}`);
  }
  return new Date(parsed).toISOString();
}
