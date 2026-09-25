import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type {
  AssignedLearningTask,
  SaveGeneratedTaskInput,
} from "@/domain/tasks/task-assignment";
import { assertTaskAssignment } from "@/domain/tasks/task-assignment";
import type {
  LearningTaskRepository,
  TaskEvaluationLookup,
} from "@/domain/tasks/learning-task-repository";
import { isCompleteTaskEvaluationLookup } from "@/domain/tasks/learning-task-repository";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";
import type { TaskGenerationTrace } from "@/domain/tasks/task-generation-result";

/**
 * Server-only adapter. Never select answer_key into a browser client.
 * Evaluation reads must bind taskId + server userId + sessionId in one query
 * so answer_key is not loaded for a foreign or missing row.
 */
export class SupabaseLearningTaskRepository implements LearningTaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  async saveGeneratedTask(input: SaveGeneratedTaskInput): Promise<void> {
    assertTaskAssignment(input.assignment);
    const { task, assignment } = input;
    const { error } = await this.client.from("learning_tasks").insert({
      id: task.publicTask.id,
      user_id: assignment.userId,
      session_id: assignment.sessionId,
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
    lookup: TaskEvaluationLookup,
  ): Promise<AssignedLearningTask | null> {
    if (!isCompleteTaskEvaluationLookup(lookup)) {
      return null;
    }
    const { data, error } = await this.client
      .from("learning_tasks")
      .select(
        "user_id, session_id, public_payload, answer_key, generation_trace",
      )
      .eq("id", lookup.taskId)
      .eq("user_id", lookup.userId)
      .eq("session_id", lookup.sessionId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    const task: GeneratedLearningTask = {
      publicTask: data.public_payload as PublicLearningTask,
      answerKey: data.answer_key as TaskAnswerKey,
      generationTrace: data.generation_trace as TaskGenerationTrace,
    };
    return {
      task,
      assignment: {
        userId: String(data.user_id ?? ""),
        sessionId: String(data.session_id ?? ""),
      },
    };
  }
}
