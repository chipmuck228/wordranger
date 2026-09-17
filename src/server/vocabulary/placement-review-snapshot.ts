import type { PlacementBand } from "@/domain/vocabulary/provisional-placement";
import type { PlacementReviewCoverage } from "@/domain/vocabulary/curated-placement";
import type { EffectivePlacementOrigin } from "@/domain/vocabulary/curated-placement";
import type { VocabularyPlacementProvider } from "@/domain/vocabulary/vocabulary-placement-provider";
import type { PlacementReviewRuntimeDiagnostics } from "./placement-review-config";
import type { VocabularyDataset } from "./load-vocabulary-dataset";

export interface PlacementReviewRow {
  lexemeId: string;
  canonicalKey: string;
  lemma: string;
  display: string;
  meaningsZh: string[];
  partsOfSpeech: string[];
  sourceIndex: number;
  starred: boolean;
  provisionalBand: string;
  curatedBand: string | null;
  effectiveBand: string;
  origin: EffectivePlacementOrigin;
  provenance: string[];
  reviewed: boolean;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface PlacementReviewSnapshot {
  coverage: PlacementReviewCoverage;
  bands: PlacementBand[];
  rows: PlacementReviewRow[];
  runtime?: PlacementReviewRuntimeDiagnostics;
  loadError?: string;
}

export type PlacementReviewStatusFilter = "all" | "reviewed" | "unreviewed";

export interface PlacementReviewQuery {
  query?: string;
  provisionalBand?: string;
  effectiveBand?: string;
  reviewStatus?: PlacementReviewStatusFilter;
}

/**
 * Bulk review snapshot. Walks dataset.lexemes once plus provider list calls.
 * Does not call getLexeme / getLexemes.
 */
export async function buildPlacementReviewSnapshot(
  dataset: VocabularyDataset,
  provider: VocabularyPlacementProvider,
): Promise<PlacementReviewSnapshot> {
  const [definition, provisional, curated, coverage] = await Promise.all([
    provider.getBandDefinition(),
    provider.listProvisionalPlacements(),
    provider.listCuratedOverrides(),
    provider.summarizePlacementReview(),
  ]);
  const lexemeById = new Map(
    dataset.lexemes.map((lexeme) => [lexeme.id, lexeme]),
  );
  const curatedById = new Map(
    curated.map((record) => [record.lexemeId, record]),
  );
  const rows: PlacementReviewRow[] = [];
  for (const record of provisional) {
    const lexeme = lexemeById.get(record.lexemeId);
    if (!lexeme) {
      continue;
    }
    const override = curatedById.get(record.lexemeId);
    rows.push({
      lexemeId: lexeme.id,
      canonicalKey: lexeme.canonicalKey,
      lemma: lexeme.lemma,
      display: lexeme.display,
      meaningsZh: [...lexeme.meaningsZh],
      partsOfSpeech: [...lexeme.partsOfSpeech],
      sourceIndex: lexeme.sourceIndex,
      starred: lexeme.starred,
      provisionalBand: record.provisionalBand.value,
      curatedBand: override?.bandId ?? null,
      effectiveBand: override?.bandId ?? record.provisionalBand.value,
      origin: override ? "CURATED" : "PROVISIONAL",
      provenance: override
        ? [...override.provenance]
        : [...record.provisionalBand.provenance],
      reviewed: Boolean(override),
      reviewNote: override?.reviewNote ?? null,
      reviewedAt: override?.reviewedAt ?? null,
    });
  }
  rows.sort((left, right) => {
    if (left.sourceIndex !== right.sourceIndex) {
      return left.sourceIndex - right.sourceIndex;
    }
    return left.canonicalKey.localeCompare(right.canonicalKey);
  });
  return {
    coverage,
    bands: definition.bands.map((band) => ({ ...band })),
    rows,
  };
}
