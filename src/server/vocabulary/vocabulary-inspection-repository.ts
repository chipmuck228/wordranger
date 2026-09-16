import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";

/**
 * Debug / QA only. Production Task Generator and games must not use this.
 */
export interface VocabularyInspectionRepository {
  getRawRelations(lexemeId: string): Promise<LexemeRelation[]>;
}
