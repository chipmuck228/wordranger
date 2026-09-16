import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";
import type { LexemeTags } from "@/domain/vocabulary/lexeme-tags";
import { selectApprovedRelations } from "@/domain/vocabulary/relation-policy";
import {
  DEFAULT_VOCABULARY_CONTENT_POLICY,
  type VocabularyContentPolicy,
} from "@/domain/vocabulary/vocabulary-content-policy";
import type {
  GetRelationsOptions,
  VocabularyRepository,
} from "@/domain/vocabulary/vocabulary-repository";
import type { VocabularySourceEntry } from "@/domain/vocabulary/source-entry";
import type { VocabularyDataset } from "./load-vocabulary-dataset";

export class InMemoryVocabularyRepository implements VocabularyRepository {
  private readonly lexemes = new Map<string, Lexeme>();
  private readonly lemmaIndex = new Map<string, Lexeme[]>();
  private readonly relationsByLexeme = new Map<string, LexemeRelation[]>();
  private readonly tags = new Map<string, LexemeTags>();
  readonly sourceEntries: VocabularySourceEntry[];
  readonly allRelations: LexemeRelation[];
  readonly policy: VocabularyContentPolicy;

  constructor(
    dataset: VocabularyDataset,
    policy: VocabularyContentPolicy = DEFAULT_VOCABULARY_CONTENT_POLICY,
  ) {
    this.sourceEntries = dataset.sourceEntries;
    this.allRelations = dataset.relations;
    this.policy = policy;
    for (const lexeme of dataset.lexemes) {
      this.lexemes.set(lexeme.id, lexeme);
      const list = this.lemmaIndex.get(lexeme.lemma.toLowerCase()) ?? [];
      list.push(lexeme);
      this.lemmaIndex.set(lexeme.lemma.toLowerCase(), list);
    }
    for (const relation of dataset.relations) {
      const fromList = this.relationsByLexeme.get(relation.fromLexemeId) ?? [];
      fromList.push(relation);
      this.relationsByLexeme.set(relation.fromLexemeId, fromList);
      if (relation.symmetric) {
        const toList = this.relationsByLexeme.get(relation.toLexemeId) ?? [];
        toList.push(relation);
        this.relationsByLexeme.set(relation.toLexemeId, toList);
      }
    }
    for (const tag of dataset.tags) {
      this.tags.set(tag.lexemeId, tag);
    }
  }

  async getLexeme(lexemeId: string): Promise<Lexeme | null> {
    return this.lexemes.get(lexemeId) ?? null;
  }

  async getLexemes(lexemeIds: string[]): Promise<Lexeme[]> {
    return lexemeIds
      .map((id) => this.lexemes.get(id))
      .filter((lexeme): lexeme is Lexeme => lexeme !== undefined);
  }

  async findLexemeByLemma(lemma: string): Promise<Lexeme[]> {
    return [...(this.lemmaIndex.get(lemma.toLowerCase()) ?? [])];
  }

  async listLexemes(): Promise<Lexeme[]> {
    return [...this.lexemes.values()];
  }

  async getRelations(
    lexemeId: string,
    options: GetRelationsOptions = {},
  ): Promise<LexemeRelation[]> {
    const candidates = this.relationsByLexeme.get(lexemeId) ?? [];
    return selectApprovedRelations(candidates, this.policy, options);
  }

  async getTags(lexemeId: string): Promise<LexemeTags | null> {
    return this.tags.get(lexemeId) ?? null;
  }

  getSourceEntry(sourceEntryId: string): VocabularySourceEntry | null {
    return (
      this.sourceEntries.find((entry) => entry.id === sourceEntryId) ?? null
    );
  }

  getLexemeByCanonicalKey(canonicalKey: string): Lexeme | null {
    return (
      [...this.lexemes.values()].find(
        (lexeme) => lexeme.canonicalKey === canonicalKey,
      ) ?? null
    );
  }
}
