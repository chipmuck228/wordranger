import type { LearningEvidence } from "./evidence.types";
import type { StudentWordModel } from "./student-word-model";

/**
 * Persistence port used by processEvidence.
 * Implementations live under src/server/learning. The engine never imports
 * a Supabase client.
 */
export interface LearningRepository {
  getStudentWordModel(
    userId: string,
    wordId: string,
  ): Promise<StudentWordModel | null>;

  getRecentEvidence(
    userId: string,
    wordId: string,
    limit?: number,
  ): Promise<LearningEvidence[]>;

  getEvidenceForWord(
    userId: string,
    wordId: string,
  ): Promise<LearningEvidence[]>;

  appendEvidence(evidence: LearningEvidence): Promise<void>;

  saveStudentWordModel(model: StudentWordModel): Promise<void>;

  /**
   * Transactional boundary for "append evidence then write snapshot".
   * In-memory is atomic. Supabase is sequential; if the snapshot write
   * fails after evidence insert, evidence remains the source of truth
   * and the snapshot can be rebuilt.
   */
  commitEvidenceAndSnapshot(
    evidence: LearningEvidence,
    model: StudentWordModel,
  ): Promise<void>;
}
