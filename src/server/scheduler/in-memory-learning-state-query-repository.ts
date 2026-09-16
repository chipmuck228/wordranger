import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import type { RecentLearningActivity } from "@/domain/scheduler/learning-need-candidate";
import type { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import type { LearningStateQueryRepository } from "./learning-state-query-repository";
import { recentActivityFromEvidence } from "./recent-activity";

export class InMemoryLearningStateQueryRepository
  implements LearningStateQueryRepository
{
  private models: StudentLexemeModel[] = [];
  private activity: RecentLearningActivity[] = [];

  constructor(private readonly source?: InMemoryLearningRepository) {}

  seed(input: {
    models?: StudentLexemeModel[];
    activity?: RecentLearningActivity[];
  }): void {
    this.models = (input.models ?? []).map((model) => structuredClone(model));
    this.activity = (input.activity ?? []).map((item) => ({ ...item }));
  }

  reset(): void {
    this.models = [];
    this.activity = [];
  }

  async listStudentLexemeModels(userId: string): Promise<StudentLexemeModel[]> {
    if (this.source) {
      return this.source.listStudentLexemeModels(userId);
    }
    return this.models
      .filter((model) => model.userId === userId)
      .map((model) => structuredClone(model));
  }

  async getRecentLearningActivity(
    userId: string,
    limit: number,
  ): Promise<RecentLearningActivity[]> {
    if (this.source) {
      return recentActivityFromEvidence(
        this.source.listEvidenceForUser(userId),
      ).slice(0, limit);
    }
    return this.activity
      .slice()
      .sort(
        (left, right) =>
          Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
      )
      .slice(0, limit)
      .map((item) => ({ ...item }));
  }
}
