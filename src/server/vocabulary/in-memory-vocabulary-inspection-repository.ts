import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";
import type { InMemoryVocabularyRepository } from "./in-memory-vocabulary-repository";
import type { VocabularyInspectionRepository } from "./vocabulary-inspection-repository";

export class InMemoryVocabularyInspectionRepository
  implements VocabularyInspectionRepository
{
  constructor(private readonly vocabulary: InMemoryVocabularyRepository) {}

  async getRawRelations(lexemeId: string): Promise<LexemeRelation[]> {
    return this.vocabulary.allRelations.filter(
      (relation) =>
        relation.fromLexemeId === lexemeId ||
        (relation.symmetric && relation.toLexemeId === lexemeId),
    );
  }
}
