import type {
  AssignedLearningTask,
  SaveGeneratedTaskInput,
} from "./task-assignment";

export interface LearningTaskRepository {
  saveGeneratedTask(input: SaveGeneratedTaskInput): Promise<void>;
  getTaskForEvaluation(taskId: string): Promise<AssignedLearningTask | null>;
}
