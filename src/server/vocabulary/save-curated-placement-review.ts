import {
  assertValidCuratedOverride,
  buildServerCuratedOverride,
  CuratedPlacementValidationError,
} from "@/domain/vocabulary/build-curated-override";
import type { CuratedPlacementOverride } from "@/domain/vocabulary/curated-placement";
import type { PlacementBandDefinition } from "@/domain/vocabulary/provisional-placement";
import type { CuratedPlacementStore } from "./curated-placement-store";
import { CuratedPlacementWriteError } from "./curated-placement-store";
import { CuratedPlacementConfigError } from "./placement-review-config";
import type { VocabularyDataset } from "./load-vocabulary-dataset";

export type SaveCuratedPlacementResult =
  | { ok: true; record: CuratedPlacementOverride }
  | { ok: false; code: string; message: string };

export async function saveCuratedPlacementReview(args: {
  lexemeId: string;
  bandId: string;
  reviewNote?: string;
  now: string;
  dataset: VocabularyDataset;
  definition: PlacementBandDefinition;
  store: CuratedPlacementStore;
}): Promise<SaveCuratedPlacementResult> {
  const record = buildServerCuratedOverride({
    lexemeId: args.lexemeId,
    bandId: args.bandId,
    reviewNote: args.reviewNote,
    now: args.now,
  });
  try {
    assertValidCuratedOverride({
      record,
      definition: args.definition,
      lexemeIds: new Set(args.dataset.lexemes.map((lexeme) => lexeme.id)),
      canonicalKeys: new Set(
        args.dataset.lexemes.map((lexeme) => lexeme.canonicalKey),
      ),
    });
    const saved = await args.store.upsert(record);
    return { ok: true, record: saved };
  } catch (error) {
    if (error instanceof CuratedPlacementValidationError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof CuratedPlacementWriteError) {
      return {
        ok: false,
        code: "CURATED_PLACEMENT_WRITE_UNAVAILABLE",
        message: error.message,
      };
    }
    if (error instanceof CuratedPlacementConfigError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
    throw error;
  }
}
