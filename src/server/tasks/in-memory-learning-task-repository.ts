import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type {
  AssignedLearningTask,
  SaveGeneratedTaskInput,
} from "@/domain/tasks/task-assignment";
import { assertTaskAssignment } from "@/domain/tasks/task-assignment";

export class InMemoryLearningTaskRepository implements LearningTaskRepository {
  private readonly tasks = new Map<string, AssignedLearningTask>();

  async saveGeneratedTask(input: SaveGeneratedTaskInput): Promise<void> {
    assertTaskAssignment(input.assignment);
    this.tasks.set(input.task.publicTask.id, {
      task: structuredClone(input.task),
      assignment: { ...input.assignment },
    });
  }

  async getTaskForEvaluation(
    taskId: string,
  ): Promise<AssignedLearningTask | null> {
    const assigned = this.tasks.get(taskId);
    return assigned ? structuredClone(assigned) : null;
  }

  reset(): void {
    this.tasks.clear();
  }

  listTaskIds(): string[] {
    return [...this.tasks.keys()];
  }
}
