import type { SupabaseClient } from "@supabase/supabase-js";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { MATCHING_GAME_TYPE, V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { MatchingSessionController } from "@/server/game-session/matching-session";
import { SupabaseGameSessionStore } from "@/server/game-session/supabase-game-session-store";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";
import { SupabaseLearningStateQueryRepository } from "@/server/scheduler/supabase-learning-state-query-repository";
import { SupabaseLearningTaskRepository } from "@/server/tasks/supabase-learning-task-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bundledVocabularyRepository } from "./bundled-vocabulary";
import type { MatchingRuntime } from "./create-in-memory-matching-runtime";

export function createSupabaseMatchingRuntime(input?: {
  client?: SupabaseClient;
  userId?: string;
}): MatchingRuntime {
  const client = input?.client ?? createSupabaseServerClient();
  if (!client) {
    throw new GameSessionError(
      "SESSION_START_FAILED",
      "Matching production runtime requires Supabase configuration",
    );
  }
  const userId = input?.userId ?? V1_PLACEHOLDER_USER_ID;
  const vocabulary = bundledVocabularyRepository();
  const learning = new SupabaseLearningRepository(client);
  const learningStateQuery = new SupabaseLearningStateQueryRepository(client);
  const tasks = new SupabaseLearningTaskRepository(client);
  const sessions = new SupabaseGameSessionStore(client, {
    expectedUserId: userId,
    expectedGameType: MATCHING_GAME_TYPE,
  });
  const generator = new DefaultTaskGenerator(vocabulary);

  function createController(): MatchingSessionController {
    return new MatchingSessionController({
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
