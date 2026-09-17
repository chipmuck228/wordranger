/**
 * Vocabulary-level placement / curriculum metadata.
 *
 * This is reference content, not learner state. It must not be stored on
 * StudentLexemeModel, LearningEvidence, game_sessions, or learning_tasks.
 *
 * Every present field carries its own provenance. Absent fields are unknown,
 * not guessed. INFERRED values are not production placement authority.
 */

export const PLACEMENT_METADATA_SOURCES = [
  "SOURCE",
  "CURATED",
  "EXTERNAL_REFERENCE",
  "INFERRED",
] as const;

export type PlacementMetadataSource =
  (typeof PLACEMENT_METADATA_SOURCES)[number];

export const PLACEMENT_FIELD_NAMES = [
  "alphabeticalSection",
  "coreFoundation",
  "functionWord",
  "curriculumBand",
  "gradeBand",
  "frequencyBand",
  "difficultyBand",
] as const;

export type PlacementFieldName = (typeof PLACEMENT_FIELD_NAMES)[number];

/** Closed-class POS values treated as function words by rule v1. */
export const FUNCTION_WORD_POS = [
  "article",
  "preposition",
  "conjunction",
  "pronoun",
  "auxiliary_verb",
  "modal_verb",
] as const;

/** POS values treated as content words by rule v1. Mixed/unknown POS stay absent. */
export const CONTENT_WORD_POS = [
  "noun",
  "adjective",
  "verb",
  "verb_transitive",
  "verb_intransitive",
] as const;

export const FUNCTION_WORD_POS_RULE_ID = "function-word-pos-rule/v1";
export const FUNCTION_WORD_RULE_CONFIDENCE = 0.8;

/**
 * Band-like fields the PDF/source does not provide. Allowed only when a later
 * curated or licensed overlay supplies them. Never inferred.
 */
export const PLACEMENT_BAND_FIELDS = [
  "curriculumBand",
  "gradeBand",
  "frequencyBand",
  "difficultyBand",
] as const;

export type PlacementBandFieldName = (typeof PLACEMENT_BAND_FIELDS)[number];

export interface PlacementField<T> {
  value: T;
  source: PlacementMetadataSource;
  provenance: string[];
  confidence?: number;
}

export interface VocabularyPlacementMetadata {
  lexemeId: string;
  alphabeticalSection?: PlacementField<string>;
  coreFoundation?: PlacementField<boolean>;
  functionWord?: PlacementField<boolean>;
  curriculumBand?: PlacementField<string>;
  gradeBand?: PlacementField<string>;
  frequencyBand?: PlacementField<string>;
  difficultyBand?: PlacementField<string>;
}

export function parsePlacementMetadataSource(
  value: string,
): PlacementMetadataSource {
  if (
    value === "SOURCE" ||
    value === "CURATED" ||
    value === "EXTERNAL_REFERENCE" ||
    value === "INFERRED"
  ) {
    return value;
  }
  throw new Error(`Unknown placement metadata source: ${value}`);
}

export function classifyFunctionWord(
  partsOfSpeech: readonly string[],
): boolean | null {
  if (partsOfSpeech.length === 0) {
    return null;
  }
  if (
    partsOfSpeech.some((pos) =>
      (FUNCTION_WORD_POS as readonly string[]).includes(pos),
    )
  ) {
    return true;
  }
  if (
    partsOfSpeech.every((pos) =>
      (CONTENT_WORD_POS as readonly string[]).includes(pos),
    )
  ) {
    return false;
  }
  return null;
}

export function placementField<T>(
  value: T,
  source: PlacementMetadataSource,
  provenance: string[],
  confidence?: number,
): PlacementField<T> {
  const field: PlacementField<T> = { value, source, provenance: [...provenance] };
  if (confidence !== undefined) {
    field.confidence = confidence;
  }
  return field;
}
