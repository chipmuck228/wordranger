import type { Lexeme } from "./lexeme";
import type {
  LexemeRelation,
  LexemeRelationProvenance,
  LexemeRelationType,
} from "./lexeme-relation";
import type { LexemeTags } from "./lexeme-tags";

export interface GetRelationsOptions {
  types?: LexemeRelationType[];
  minConfidence?: number;
  provenances?: LexemeRelationProvenance[];
}

export interface VocabularyRepository {
  getLexeme(lexemeId: string): Promise<Lexeme | null>;
  getLexemes(lexemeIds: string[]): Promise<Lexeme[]>;
  findLexemeByLemma(lemma: string): Promise<Lexeme[]>;
  getRelations(
    lexemeId: string,
    options?: GetRelationsOptions,
  ): Promise<LexemeRelation[]>;
  getTags(lexemeId: string): Promise<LexemeTags | null>;
}
