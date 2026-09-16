import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import type { RecentLearningActivity } from "@/domain/scheduler/learning-need-candidate";

export interface LearningStateQueryRepository {
  listStudentLexemeModels(userId: string): Promise<StudentLexemeModel[]>;
  getRecentLearningActivity(
    userId: string,
    limit: number,
  ): Promise<RecentLearningActivity[]>;
}
