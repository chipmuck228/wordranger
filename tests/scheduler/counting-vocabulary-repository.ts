import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";
import type { LexemeTags } from "@/domain/vocabulary/lexeme-tags";
import type {
  GetRelationsOptions,
  VocabularyRepository,
} from "@/domain/vocabulary/vocabulary-repository";

export interface VocabularyRepositoryCallCounts {
  listLexemes: number;
  listRelations: number;
  getRelations: number;
  getLexeme: number;
  getLexemes: number;
  findLexemeByLemma: number;
  getTags: number;
}

export class CountingVocabularyRepository implements VocabularyRepository {
  readonly calls: VocabularyRepositoryCallCounts = {
    listLexemes: 0,
    listRelations: 0,
    getRelations: 0,
    getLexeme: 0,
    getLexemes: 0,
    findLexemeByLemma: 0,
    getTags: 0,
  };

  constructor(private readonly inner: VocabularyRepository) {}

  async getLexeme(lexemeId: string): Promise<Lexeme | null> {
    this.calls.getLexeme += 1;
    return this.inner.getLexeme(lexemeId);
  }

  async getLexemes(lexemeIds: string[]): Promise<Lexeme[]> {
    this.calls.getLexemes += 1;
    return this.inner.getLexemes(lexemeIds);
  }

  async findLexemeByLemma(lemma: string): Promise<Lexeme[]> {
    this.calls.findLexemeByLemma += 1;
    return this.inner.findLexemeByLemma(lemma);
  }

  async listLexemes(): Promise<Lexeme[]> {
    this.calls.listLexemes += 1;
    return this.inner.listLexemes();
  }

  async getRelations(
    lexemeId: string,
    options?: GetRelationsOptions,
  ): Promise<LexemeRelation[]> {
    this.calls.getRelations += 1;
    return this.inner.getRelations(lexemeId, options);
  }

  async listRelations(options?: GetRelationsOptions): Promise<LexemeRelation[]> {
    this.calls.listRelations += 1;
    return this.inner.listRelations(options);
  }

  async getTags(lexemeId: string): Promise<LexemeTags | null> {
    this.calls.getTags += 1;
    return this.inner.getTags(lexemeId);
  }
}
