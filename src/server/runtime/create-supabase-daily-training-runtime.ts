import type { SupabaseClient } from "@supabase/supabase-js";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import {
  DAILY_TRAINING_TASK_COUNT,
  V1_PLACEHOLDER_USER_ID,
} from "@/server/auth/v1-user";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";
import { SupabaseLearningStateQueryRepository } from "@/server/scheduler/supabase-learning-state-query-repository";
import { SupabaseLearningTaskRepository } from "@/server/tasks/supabase-learning-task-repository";
import { DailyTrainingController } from "@/server/training/daily-training-controller";
import { SupabaseDailyTrainingSessionStore } from "@/server/training/supabase-daily-training-session-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bundledVocabularyRepository } from "./bundled-vocabulary";
import type { DailyTrainingRuntime } from "./create-in-memory-daily-training-runtime";

export function createSupabaseDailyTrainingRuntime(input?: {
  client?: SupabaseClient;
  userId?: string;
  requestedNeedCount?: number;
}): DailyTrainingRuntime {
  const client = input?.client ?? createSupabaseServerClient();
  if (!client) {
    throw new GameSessionError(
      "SESSION_START_FAILED",
      "Daily Training production runtime requires Supabase configuration",
    );
  }
  const userId = input?.userId ?? V1_PLACEHOLDER_USER_ID;
  const vocabulary = bundledVocabularyRepository();
  const learning = new SupabaseLearningRepository(client);
  const learningStateQuery = new SupabaseLearningStateQueryRepository(client);
  const tasks = new SupabaseLearningTaskRepository(client);
  const sessions = new SupabaseDailyTrainingSessionStore(client, {
    expectedUserId: userId,
  });
  const generator = new DefaultTaskGenerator(vocabulary);

  function createController(): DailyTrainingController {
    return new DailyTrainingController({
      userId,
      vocabulary,
      query: learningStateQuery,
      tasks,
      learning,
      sessions,
      generator,
      createId: () => crypto.randomUUID(),
      createSessionId: () => crypto.randomUUID(),
      createEvidenceId: () => crypto.randomUUID(),
      requestedNeedCount: input?.requestedNeedCount ?? DAILY_TRAINING_TASK_COUNT,
    });
  }

  return {
    vocabulary,
    learning,
    learningStateQuery,
    tasks,
    sessions,
    createController,
  };
}
