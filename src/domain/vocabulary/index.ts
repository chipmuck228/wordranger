export type { VocabularySourceEntry, SourceParseStatus } from "./source-entry";
export type { Lexeme, LexemeRole, LexemeQuality } from "./lexeme";
export type { LexemeMeaning, LexemeMeaningZh } from "./lexeme-meaning";
export {
  LexemeRelationType,
  parseLexemeRelationType,
  parseLexemeRelationProvenance,
  type LexemeRelation,
  type LexemeRelationProvenance,
} from "./lexeme-relation";
export type { LexemeTags } from "./lexeme-tags";
export type {
  PlacementField,
  PlacementFieldName,
  PlacementMetadataSource,
  VocabularyPlacementMetadata,
} from "./placement-metadata";
export {
  CONTENT_WORD_POS,
  FUNCTION_WORD_POS,
  FUNCTION_WORD_POS_RULE_ID,
  FUNCTION_WORD_RULE_CONFIDENCE,
  PLACEMENT_BAND_FIELDS,
  PLACEMENT_FIELD_NAMES,
  PLACEMENT_METADATA_SOURCES,
  classifyFunctionWord,
  parsePlacementMetadataSource,
} from "./placement-metadata";
export {
  buildPlacementMetadata,
  derivePlacementMetadata,
} from "./derive-placement-metadata";
export {
  placementMetadataIssues,
  type PlacementMetadataIssue,
} from "./validate-placement-metadata";
export {
  ADAPTIVE_PLACEMENT_READINESS,
  MIN_AUTHORITATIVE_PLACEMENT_BANDS,
  MIN_AUTHORITATIVE_PLACEMENT_COVERAGE,
  PLACEMENT_AXIS_PRIORITY,
  PRODUCTION_PLACEMENT_SOURCES,
  assessAdaptivePlacementReadiness,
  type AdaptivePlacementReadiness,
  type AdaptivePlacementReadinessStatus,
} from "./adaptive-placement-readiness";
export type { VocabularyRepository, GetRelationsOptions } from "./vocabulary-repository";
export type { VocabularyPlacementProvider } from "./vocabulary-placement-provider";
export type {
  PlacementBand,
  PlacementBandDefinition,
  ProvisionalLexemePlacement,
  ProvisionalPlacementBandId,
  ProvisionalPlacementQaReport,
} from "./provisional-placement";
export {
  PROVISIONAL_BAND_STRATEGY_ID,
  PROVISIONAL_PLACEMENT_BAND_IDS,
  PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
  PROVISIONAL_PLACEMENT_VERSION,
  orderedPlacementBands,
} from "./provisional-placement";
export {
  generateProvisionalAssignments,
  summarizeProvisionalPlacement,
} from "./generate-provisional-placement";
export {
  provisionalPlacementIssues,
  type ProvisionalPlacementIssue,
} from "./validate-provisional-placement";
export {
  DEFAULT_VOCABULARY_CONTENT_POLICY,
  type VocabularyContentPolicy,
} from "./vocabulary-content-policy";
export { relationMeetsContentPolicy, selectApprovedRelations, sortLexemeRelations } from "./relation-policy";
export {
  relationInvariantIssues,
  assertRelationInvariants,
} from "./validate-relation";
