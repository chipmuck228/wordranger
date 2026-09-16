import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { RangerTrialSessionController } from "@/server/game-session/ranger-trial-session";
import { InMemoryRangerTrialSessionStore } from "@/server/game-session/in-memory-ranger-trial-session-store";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import type { RangerTrialRuntime } from "./ranger-trial-runtime";

export interface CreateInMemoryRangerTrialRuntimeOptions {
  userId: string;
  now?: () => string;
  createSessionId?: () => string;
  createId?: () => string;
  createEvidenceId?: () => string;
  requestedNeedCount?: number;
  learning?: InMemoryLearningRepository;
  tasks?: InMemoryLearningTaskRepository;
  sessions?: InMemoryRangerTrialSessionStore;
}

export interface InMemoryRangerTrialRuntime extends RangerTrialRuntime {
  learning: InMemoryLearningRepository;
  learningStateQuery: InMemoryLearningStateQueryRepository;
  tasks: InMemoryLearningTaskRepository;
  rangerTrialSessions: InMemoryRangerTrialSessionStore;
}

/**
 * Shared in-memory adapters for tests and explicit local/e2e fixtures.
 * Not a production serverless runtime.
 */
export function createInMemoryRangerTrialRuntime(
  options: CreateInMemoryRangerTrialRuntimeOptions,
): InMemoryRangerTrialRuntime {
  const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
  const learning = options.learning ?? new InMemoryLearningRepository();
  const learningStateQuery = new InMemoryLearningStateQueryRepository(learning);
  const tasks = options.tasks ?? new InMemoryLearningTaskRepository();
  const rangerTrialSessions =
    options.sessions ?? new InMemoryRangerTrialSessionStore();
  const generator = new DefaultTaskGenerator(vocabulary);

  function createController(): RangerTrialSessionController {
    return new RangerTrialSessionController({
      userId: options.userId,
      vocabulary,
      query: learningStateQuery,
      tasks,
      learning,
      sessions: rangerTrialSessions,
      generator,
      now: options.now,
      createSessionId: options.createSessionId,
      createId: options.createId,
      createEvidenceId: options.createEvidenceId,
      requestedNeedCount: options.requestedNeedCount,
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
