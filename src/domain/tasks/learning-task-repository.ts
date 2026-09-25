import type {
  AssignedLearningTask,
  SaveGeneratedTaskInput,
} from "./task-assignment";

export interface TaskEvaluationLookup {
  taskId: string;
  userId: string;
  sessionId: string;
}

export function isCompleteTaskEvaluationLookup(
  lookup: TaskEvaluationLookup,
): boolean {
  return Boolean(
    lookup.taskId.trim() && lookup.userId.trim() && lookup.sessionId.trim(),
  );
}

export interface LearningTaskRepository {
  saveGeneratedTask(input: SaveGeneratedTaskInput): Promise<void>;
  getTaskForEvaluation(
    lookup: TaskEvaluationLookup,
  ): Promise<AssignedLearningTask | null>;
}
