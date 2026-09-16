import type { LearningNeed } from "@/domain/learning/learning-need";
import type { RandomSource } from "./random-source";
import type { LearningTaskType } from "./task-type";

export interface RecentTaskSummary {
  taskId: string;
  taskType: LearningTaskType | string;
  lexemeId: string;
}

export interface TaskGenerationRequest {
  need: LearningNeed;
  desiredDifficulty: number;
  recentTasks: RecentTaskSummary[];
  now: string;
  createId: () => string;
  random: RandomSource;
}
