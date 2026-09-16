import type { SupabaseClient } from "@supabase/supabase-js";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { RangerTrialSessionController } from "@/server/game-session/ranger-trial-session";
import { SupabaseRangerTrialSessionStore } from "@/server/game-session/supabase-ranger-trial-session-store";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";
import { SupabaseLearningStateQueryRepository } from "@/server/scheduler/supabase-learning-state-query-repository";
import { SupabaseLearningTaskRepository } from "@/server/tasks/supabase-learning-task-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bundledVocabularyRepository } from "./bundled-vocabulary";
import type { RangerTrialRuntime } from "./ranger-trial-runtime";

/**
 * Production Ranger Trial composition root.
 *
 * Vocabulary is immutable bundled reference data (git JSON). Learner state,
 * assigned tasks, evidence, and game-session orchestration are durable
 * Supabase adapters. One server client is shared across those adapters.
 */
export function createSupabaseRangerTrialRuntime(input?: {
  client?: SupabaseClient;
  userId?: string;
}): RangerTrialRuntime {
  const client = input?.client ?? createSupabaseServerClient();
  if (!client) {
    throw new GameSessionError(
      "SESSION_START_FAILED",
      "Ranger Trial production runtime requires Supabase configuration",
    );
  }
  const userId = input?.userId ?? V1_PLACEHOLDER_USER_ID;
  const vocabulary = bundledVocabularyRepository();
  const learning = new SupabaseLearningRepository(client);
  const learningStateQuery = new SupabaseLearningStateQueryRepository(client);
  const tasks = new SupabaseLearningTaskRepository(client);
  const rangerTrialSessions = new SupabaseRangerTrialSessionStore(
    client,
    userId,
  );
  const generator = new DefaultTaskGenerator(vocabulary);

  function createController(): RangerTrialSessionController {
    return new RangerTrialSessionController({
      userId,
      vocabulary,
      query: learningStateQuery,
      tasks,
      learning,
      sessions: rangerTrialSessions,
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
    rangerTrialSessions,
    createController,
  };
}
