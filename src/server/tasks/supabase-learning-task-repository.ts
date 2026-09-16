import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import type { TaskGenerationTrace } from "@/domain/tasks/task-generation-result";

/**
 * Server-only adapter. Never select answer_key into a browser client.
 */
export class SupabaseLearningTaskRepository implements LearningTaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  async saveGeneratedTask(task: GeneratedLearningTask): Promise<void> {
    const { error } = await this.client.from("learning_tasks").insert({
      id: task.publicTask.id,
      learning_need_id: task.publicTask.learningNeedId,
      lexeme_id: task.publicTask.lexemeId,
      target_skill: task.publicTask.targetSkill,
      task_type: task.publicTask.taskType,
      protocol_version: task.publicTask.protocolVersion,
      generator_version: task.publicTask.generatorVersion,
      prompt_mode: task.publicTask.promptMode,
      answer_mode: task.publicTask.answerMode,
      difficulty: task.publicTask.difficulty,
      public_payload: task.publicTask,
      answer_key: task.answerKey,
      generation_trace: task.generationTrace,
      created_at: task.publicTask.createdAt,
    });
    if (error) {
      throw error;
    }
  }

  async getTaskForEvaluation(
    taskId: string,
  ): Promise<GeneratedLearningTask | null> {
    const { data, error } = await this.client
      .from("learning_tasks")
      .select("public_payload, answer_key, generation_trace")
      .eq("id", taskId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    return {
      publicTask: data.public_payload as PublicLearningTask,
      answerKey: data.answer_key as TaskAnswerKey,
      generationTrace: data.generation_trace as TaskGenerationTrace,
    };
  }
}
