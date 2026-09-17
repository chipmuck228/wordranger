/**
 * Provisional review-bucket placement. Vocabulary Domain scaffolding only.
 *
 * Not grade, CEFR, frequency, pedagogical difficulty, or mastery.
 * Not production Adaptive Placement authority.
 * Must not be stored on StudentLexemeModel, LearningEvidence,
 * learning_tasks, or game_sessions.
 */

import type { PlacementField } from "./placement-metadata";

export const PROVISIONAL_PLACEMENT_VERSION = "provisional-v1";
export const PROVISIONAL_PLACEMENT_GENERATOR_VERSION =
  "wordranger-provisional-band-generator/v1";
/**
 * Stable partition of canonical lexemes into review buckets.
 * `sourceIndex` is a sort key only (PDF list order), then `canonicalKey`.
 * Round-robin assignment after that sort so neighboring list items land
 * in different buckets. This is not difficulty, curriculum, or grade.
 */
export const PROVISIONAL_BAND_STRATEGY_ID =
  "balanced-source-index-round-robin/v1";

export const PROVISIONAL_PLACEMENT_BAND_IDS = [
  "BAND_1",
  "BAND_2",
  "BAND_3",
  "BAND_4",
  "BAND_5",
  "BAND_6",
] as const;

export type ProvisionalPlacementBandId =
  (typeof PROVISIONAL_PLACEMENT_BAND_IDS)[number];

export interface PlacementBand {
  id: string;
  order: number;
}

export interface PlacementBandDefinition {
  version: string;
  description?: string;
  bands: PlacementBand[];
}

export interface ProvisionalLexemePlacement {
  lexemeId: string;
  provisionalBand: PlacementField<string>;
}

export interface ProvisionalPlacementQaReport {
  totalCanonicalLexemes: number;
  assignedLexemes: number;
  coverage: number;
  bandCounts: Record<string, number>;
  duplicateLexemeIds: string[];
  missingLexemeIds: string[];
  unknownLexemeIds: string[];
  generatorVersion: string;
}

export interface ProvisionalWordPlacementFile {
  meta: {
    version: string;
    generatorVersion: string;
    strategy: string;
    authoritative: false;
    qa: ProvisionalPlacementQaReport;
  };
  records: ProvisionalLexemePlacement[];
}

export interface LexemeProvisionalIdentity {
  canonicalKey: string;
  sourceIndex: number;
}

/** Consumers must use explicit `order`. Never sort band IDs alphabetically. */
export function orderedPlacementBands(
  definition: PlacementBandDefinition,
): PlacementBand[] {
  return [...definition.bands].sort((left, right) => left.order - right.order);
}

export function compareProvisionalLexemeIdentity(
  left: LexemeProvisionalIdentity,
  right: LexemeProvisionalIdentity,
): number {
  if (left.sourceIndex !== right.sourceIndex) {
    return left.sourceIndex - right.sourceIndex;
  }
  return left.canonicalKey.localeCompare(right.canonicalKey);
}
