import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";

export class InMemoryLearningTaskRepository implements LearningTaskRepository {
  private readonly tasks = new Map<string, GeneratedLearningTask>();

  async saveGeneratedTask(task: GeneratedLearningTask): Promise<void> {
    this.tasks.set(task.publicTask.id, structuredClone(task));
  }

  async getTaskForEvaluation(
    taskId: string,
  ): Promise<GeneratedLearningTask | null> {
    const task = this.tasks.get(taskId);
    return task ? structuredClone(task) : null;
  }
}
