import "server-only";

import { compareTerminalEvidenceDesc } from "./recently-incorrect";
import type {
  FreePracticeLearnerSnapshot,
  FreePracticePlanReadPort,
  FreePracticeTerminalEvidence,
} from "./types";
import type { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";

/**
 * Memory-runtime plan read port. Reads the same InMemoryLearningRepository
 * that the frozen learning pipeline writes. Not a second learner store.
 */
export class LearningBackedFreePracticePlanReadAdapter
  implements FreePracticePlanReadPort
{
  constructor(private readonly learning: InMemoryLearningRepository) {}

  async listStudentLexemeSnapshots(
    userId: string,
  ): Promise<FreePracticeLearnerSnapshot[]> {
    return this.learning.listStudentLexemeModels(userId).map((model) => ({
      lexemeId: model.lexemeId,
      masteryStage: model.masteryStage,
    }));
  }

  async listRecentTerminalEvidence(
    userId: string,
    limit: number,
  ): Promise<FreePracticeTerminalEvidence[]> {
    return this.learning
      .listEvidenceForUser(userId)
      .map((item) => ({
        id: item.id,
        lexemeId: item.lexemeId,
        skill: item.skill,
        outcome: item.outcome,
        occurredAt: item.occurredAt,
      }))
      .sort(compareTerminalEvidenceDesc)
      .slice(0, limit);
  }
}
