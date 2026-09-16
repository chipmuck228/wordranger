import type { LearningEvidence } from "./evidence.types";
import type { StudentLexemeModel } from "./student-lexeme-model";

/**
 * Persistence port used by processEvidence.
 * Implementations live under src/server/learning. The engine never imports
 * a Supabase client.
 */
export interface LearningRepository {
  getStudentLexemeModel(
    userId: string,
    lexemeId: string,
  ): Promise<StudentLexemeModel | null>;

  getRecentEvidence(
    userId: string,
    lexemeId: string,
    limit?: number,
  ): Promise<LearningEvidence[]>;

  getEvidenceForLexeme(
    userId: string,
    lexemeId: string,
  ): Promise<LearningEvidence[]>;

  appendEvidence(evidence: LearningEvidence): Promise<void>;

  saveStudentLexemeModel(model: StudentLexemeModel): Promise<void>;

  /**
   * Transactional boundary for "append evidence then write snapshot".
   * In-memory is atomic. Supabase is sequential; if the snapshot write
   * fails after evidence insert, evidence remains the source of truth
   * and the snapshot can be rebuilt.
   */
  commitEvidenceAndSnapshot(
    evidence: LearningEvidence,
    model: StudentLexemeModel,
  ): Promise<void>;
}
