import type {
  LearningTaskRepository,
  TaskEvaluationLookup,
} from "@/domain/tasks/learning-task-repository";
import { isCompleteTaskEvaluationLookup } from "@/domain/tasks/learning-task-repository";
import type {
  AssignedLearningTask,
  SaveGeneratedTaskInput,
} from "@/domain/tasks/task-assignment";
import { assertTaskAssignment } from "@/domain/tasks/task-assignment";

export class InMemoryLearningTaskRepository implements LearningTaskRepository {
  private readonly tasks = new Map<string, AssignedLearningTask>();

  async saveGeneratedTask(input: SaveGeneratedTaskInput): Promise<void> {
    assertTaskAssignment(input.assignment);
    if (this.tasks.has(input.task.publicTask.id)) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    this.tasks.set(input.task.publicTask.id, {
      task: structuredClone(input.task),
      assignment: { ...input.assignment },
    });
  }

  async getTaskForEvaluation(
    lookup: TaskEvaluationLookup,
  ): Promise<AssignedLearningTask | null> {
    if (!isCompleteTaskEvaluationLookup(lookup)) {
      return null;
    }
    const assigned = this.tasks.get(lookup.taskId);
    if (
      !assigned ||
      assigned.assignment.userId !== lookup.userId ||
      assigned.assignment.sessionId !== lookup.sessionId
    ) {
      return null;
    }
    return structuredClone(assigned);
  }

  reset(): void {
    this.tasks.clear();
  }

  listTaskIds(): string[] {
    return [...this.tasks.keys()];
  }
}
