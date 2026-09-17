import type { Lexeme } from "./lexeme";
import {
  classifyFunctionWord,
  FUNCTION_WORD_POS_RULE_ID,
  FUNCTION_WORD_RULE_CONFIDENCE,
  placementField,
  PLACEMENT_BAND_FIELDS,
  PLACEMENT_FIELD_NAMES,
  type PlacementBandFieldName,
  type PlacementFieldName,
  type VocabularyPlacementMetadata,
} from "./placement-metadata";
import type { VocabularySourceEntry } from "./source-entry";

export interface PlacementSourceSection {
  id: string;
  section: string | null;
}

export function derivePlacementMetadata(
  lexemes: readonly Lexeme[],
  sourceEntries: readonly PlacementSourceSection[],
): VocabularyPlacementMetadata[] {
  const sectionBySourceId = new Map(
    sourceEntries.map((entry) => [entry.id, entry.section]),
  );
  return lexemes.map((lexeme) =>
    deriveOnePlacementRecord(lexeme, sectionBySourceId.get(lexeme.sourceEntryId)),
  );
}

export function deriveOnePlacementRecord(
  lexeme: Lexeme,
  sourceSection: string | null | undefined,
): VocabularyPlacementMetadata {
  const record: VocabularyPlacementMetadata = {
    lexemeId: lexeme.id,
    starred: placementField(lexeme.starred, "SOURCE", ["pdf.starred"]),
  };

  if (sourceSection) {
    record.alphabeticalSection = placementField(sourceSection, "SOURCE", [
      "pdf.section",
    ]);
  }

  const functionWord = classifyFunctionWord(lexeme.partsOfSpeech);
  if (functionWord !== null) {
    record.functionWord = placementField(
      functionWord,
      "INFERRED",
      ["canonical.partsOfSpeech", FUNCTION_WORD_POS_RULE_ID],
      FUNCTION_WORD_RULE_CONFIDENCE,
    );
  }

  return record;
}

/**
 * Overlay may add CURATED / EXTERNAL_REFERENCE fields that derivation left
 * absent. It must not overwrite SOURCE facts or invent INFERRED bands.
 */
export function mergePlacementOverlay(
  derived: readonly VocabularyPlacementMetadata[],
  overlay: readonly VocabularyPlacementMetadata[],
): VocabularyPlacementMetadata[] {
  const overlayById = new Map(
    overlay.map((record) => [record.lexemeId, record]),
  );
  return derived.map((record) => {
    const extra = overlayById.get(record.lexemeId);
    if (!extra) {
      return record;
    }
    const merged: VocabularyPlacementMetadata = { ...record };
    for (const name of PLACEMENT_FIELD_NAMES) {
      const overlayField = extra[name];
      if (!overlayField) {
        continue;
      }
      const existing = merged[name];
      if (existing?.source === "SOURCE") {
        continue;
      }
      if (existing) {
        continue;
      }
      if (isBandField(name) && overlayField.source === "INFERRED") {
        continue;
      }
      merged[name] = overlayField as never;
    }
    return merged;
  });
}

function isBandField(name: PlacementFieldName): name is PlacementBandFieldName {
  return (PLACEMENT_BAND_FIELDS as readonly string[]).includes(name);
}

export function buildPlacementMetadata(
  lexemes: readonly Lexeme[],
  sourceEntries: readonly Pick<VocabularySourceEntry, "id" | "section">[],
  overlay: readonly VocabularyPlacementMetadata[] = [],
): VocabularyPlacementMetadata[] {
  const derived = derivePlacementMetadata(lexemes, sourceEntries);
  if (overlay.length === 0) {
    return derived;
  }
  return mergePlacementOverlay(derived, overlay);
}
