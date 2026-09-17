"use server";

import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import {
  FileCuratedPlacementStore,
  curatedPlacementFilePath,
} from "@/server/vocabulary/curated-placement-store";
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

export async function loadPlacementReviewSnapshot(): Promise<PlacementReviewSnapshot> {
  const dataset = getVocabularyDataset();
  const provider = bundledVocabularyPlacementProvider(dataset);
  return buildPlacementReviewSnapshot(dataset, provider);
}

export async function saveVocabularyPlacementReview(input: {
  lexemeId: string;
  bandId: string;
  reviewNote?: string;
}): Promise<SaveCuratedPlacementResult> {
  const dataset = getVocabularyDataset();
  const definition = readProvisionalBandDefinition();
  return saveCuratedPlacementReview({
    lexemeId: input.lexemeId,
    bandId: input.bandId,
    reviewNote: input.reviewNote,
    now: new Date().toISOString(),
    dataset,
    definition,
    store: new FileCuratedPlacementStore(curatedPlacementFilePath(), definition),
  });
}
