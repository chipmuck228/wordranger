import type { Lexeme } from "./lexeme";
import type {
  LexemeRelation,
  LexemeRelationProvenance,
  LexemeRelationType,
} from "./lexeme-relation";
import type { LexemeTags } from "./lexeme-tags";
import type { VocabularyPlacementMetadata } from "./placement-metadata";

export interface GetRelationsOptions {
  types?: LexemeRelationType[];
  minConfidence?: number;
  provenances?: LexemeRelationProvenance[];
}

export interface VocabularyRepository {
  getLexeme(lexemeId: string): Promise<Lexeme | null>;
  getLexemes(lexemeIds: string[]): Promise<Lexeme[]>;
  findLexemeByLemma(lemma: string): Promise<Lexeme[]>;
  listLexemes(): Promise<Lexeme[]>;
  getRelations(
    lexemeId: string,
    options?: GetRelationsOptions,
  ): Promise<LexemeRelation[]>;
  /**
   * Production-approved relation graph. Same policy ∩ caller-filter
   * contract as getRelations(). Order is deterministic:
   * type, fromLexemeId, toLexemeId, id.
   */
  listRelations(options?: GetRelationsOptions): Promise<LexemeRelation[]>;
  getTags(lexemeId: string): Promise<LexemeTags | null>;
  /**
   * Bulk placement / curriculum metadata keyed by lexemeId.
   * Derived from vocabulary reference data. Not learner state.
   * Callers must not treat this as production placement authority yet.
   */
  listPlacementMetadata(): Promise<VocabularyPlacementMetadata[]>;
}
