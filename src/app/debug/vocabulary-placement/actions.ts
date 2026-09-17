"use server";

import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { createCuratedPlacementStore } from "@/server/vocabulary/create-curated-placement-store";
import {
  bundledVocabularyPlacementProvider,
  readProvisionalBandDefinition,
} from "@/server/vocabulary/file-vocabulary-placement-provider";
import { saveCuratedPlacementReview } from "@/server/vocabulary/save-curated-placement-review";
import type { SaveCuratedPlacementResult } from "@/server/vocabulary/save-curated-placement-review";
import {
  buildPlacementReviewSnapshot,
  type PlacementReviewSnapshot,
} from "@/server/vocabulary/placement-review-snapshot";
import {
  CuratedPlacementConfigError,
  describePlacementReviewRuntime,
  placementReviewWritesEnabled,
  type PlacementReviewRuntimeDiagnostics,
} from "@/server/vocabulary/placement-review-config";
import type { CuratedPlacementStore } from "@/server/vocabulary/curated-placement-store";
import { InMemoryCuratedPlacementStore } from "@/server/vocabulary/curated-placement-store";

export interface PlacementReviewPageSnapshot extends PlacementReviewSnapshot {
  runtime: PlacementReviewRuntimeDiagnostics;
  loadError?: string;
}

function emptyCoverage(totalLexemes: number) {
  return {
    totalLexemes,
    provisionalCount: totalLexemes,
    reviewedCount: 0,
    reviewedCoverage: 0,
    unreviewedCount: totalLexemes,
    reviewedBandCounts: Object.fromEntries(
      readProvisionalBandDefinition().bands.map((band) => [band.id, 0]),
    ),
  };
}

export async function loadPlacementReviewSnapshot(): Promise<PlacementReviewPageSnapshot> {
  const dataset = getVocabularyDataset();
  const runtime = describePlacementReviewRuntime();
  let store: CuratedPlacementStore;
  try {
    store = createCuratedPlacementStore({
      definition: readProvisionalBandDefinition(),
      lexemeIds: new Set(dataset.lexemes.map((lexeme) => lexeme.id)),
      canonicalKeys: new Set(dataset.lexemes.map((lexeme) => lexeme.canonicalKey)),
    });
  } catch (error) {
    const message =
      error instanceof CuratedPlacementConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Curated placement store is not configured";
    console.error("placement review store configuration error", {
      code:
        error instanceof CuratedPlacementConfigError
          ? error.code
          : "CURATED_PLACEMENT_STORE_FAILED",
      message,
      runtime,
    });
    const snapshot = await buildPlacementReviewSnapshot(
      dataset,
      bundledVocabularyPlacementProvider(
        dataset,
        new InMemoryCuratedPlacementStore(),
      ),
    );
    return {
      ...snapshot,
      coverage: emptyCoverage(dataset.lexemes.length),
      runtime,
      loadError: message,
    };
  }
  try {
    const snapshot = await buildPlacementReviewSnapshot(
      dataset,
      bundledVocabularyPlacementProvider(dataset, store),
    );
    return { ...snapshot, runtime };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load curated placement";
    console.error("placement review load error", { message, runtime });
    const snapshot = await buildPlacementReviewSnapshot(
      dataset,
      bundledVocabularyPlacementProvider(
        dataset,
        new InMemoryCuratedPlacementStore(),
      ),
    );
    return {
      ...snapshot,
      coverage: emptyCoverage(dataset.lexemes.length),
      runtime,
      loadError: message,
    };
  }
}

export async function saveVocabularyPlacementReview(input: {
  lexemeId: string;
  bandId: string;
  reviewNote?: string;
}): Promise<SaveCuratedPlacementResult> {
  if (!placementReviewWritesEnabled()) {
    return {
      ok: false,
      code: "PLACEMENT_REVIEW_WRITE_DISABLED",
      message:
        "Placement review writes are disabled. Set PLACEMENT_REVIEW_WRITE_ENABLED=1 on a protected internal deployment. Hiding /debug/vocabulary-placement is not authorization.",
    };
  }
  const dataset = getVocabularyDataset();
  const definition = readProvisionalBandDefinition();
  try {
    return await saveCuratedPlacementReview({
      lexemeId: input.lexemeId,
      bandId: input.bandId,
      reviewNote: input.reviewNote,
      now: new Date().toISOString(),
      dataset,
      definition,
      store: createCuratedPlacementStore({
        definition,
        lexemeIds: new Set(dataset.lexemes.map((lexeme) => lexeme.id)),
        canonicalKeys: new Set(
          dataset.lexemes.map((lexeme) => lexeme.canonicalKey),
        ),
      }),
    });
  } catch (error) {
    if (error instanceof CuratedPlacementConfigError) {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
}
