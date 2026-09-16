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
export type { VocabularyRepository, GetRelationsOptions } from "./vocabulary-repository";
export {
  DEFAULT_VOCABULARY_CONTENT_POLICY,
  type VocabularyContentPolicy,
} from "./vocabulary-content-policy";
export { relationMeetsContentPolicy, selectApprovedRelations } from "./relation-policy";
export {
  relationInvariantIssues,
  assertRelationInvariants,
} from "./validate-relation";
