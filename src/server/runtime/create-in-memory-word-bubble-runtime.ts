import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { WordBubbleSessionController } from "@/server/game-session/word-bubble-session";
import { InMemoryGameSessionStore } from "@/server/game-session/in-memory-game-session-store";
import { WORD_BUBBLE_GAME_TYPE } from "@/server/auth/v1-user";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import type { LearningStateQueryRepository } from "@/server/scheduler/learning-state-query-repository";
import type { GameSessionStore } from "@/server/game-session/learning-game-session.types";

export interface CreateInMemoryWordBubbleRuntimeOptions {
  userId: string;
  now?: () => string;
  createSessionId?: () => string;
  createId?: () => string;
  createEvidenceId?: () => string;
  requestedNeedCount?: number;
  learning?: InMemoryLearningRepository;
  tasks?: InMemoryLearningTaskRepository;
  sessions?: InMemoryGameSessionStore;
  vocabulary?: VocabularyRepository;
}

export interface WordBubbleRuntime {
  vocabulary: VocabularyRepository;
  learning: LearningRepository;
  learningStateQuery: LearningStateQueryRepository;
  tasks: LearningTaskRepository;
  sessions: GameSessionStore;
  createController(): WordBubbleSessionController;
}

export interface InMemoryWordBubbleRuntime extends WordBubbleRuntime {
  learning: InMemoryLearningRepository;
  learningStateQuery: InMemoryLearningStateQueryRepository;
  tasks: InMemoryLearningTaskRepository;
  sessions: InMemoryGameSessionStore;
}

export function createInMemoryWordBubbleRuntime(
  options: CreateInMemoryWordBubbleRuntimeOptions,
): InMemoryWordBubbleRuntime {
  const vocabulary =
    options.vocabulary ??
    new InMemoryVocabularyRepository(loadVocabularyDataset());
  const learning = options.learning ?? new InMemoryLearningRepository();
  const learningStateQuery = new InMemoryLearningStateQueryRepository(learning);
  const tasks = options.tasks ?? new InMemoryLearningTaskRepository();
  const sessions =
    options.sessions ?? new InMemoryGameSessionStore(WORD_BUBBLE_GAME_TYPE);
  const generator = new DefaultTaskGenerator(vocabulary);

  function createController(): WordBubbleSessionController {
    return new WordBubbleSessionController({
      userId: options.userId,
      vocabulary,
      query: learningStateQuery,
      tasks,
      learning,
      sessions,
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
    sessions,
    createController,
  };
}
