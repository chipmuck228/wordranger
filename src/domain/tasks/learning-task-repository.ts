import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";

export interface LearningTaskRepository {
  saveGeneratedTask(task: GeneratedLearningTask): Promise<void>;
  getTaskForEvaluation(taskId: string): Promise<GeneratedLearningTask | null>;
}
