import type { LearningRepository } from "@/domain/learning/learning-repository";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
import { RangerTrialSessionController } from "@/server/game-session/ranger-trial-session";
import type { RangerTrialSessionStore } from "@/server/game-session/ranger-trial-session.types";
import type { LearningStateQueryRepository } from "@/server/scheduler/learning-state-query-repository";

export interface RangerTrialRuntime {
  vocabulary: VocabularyRepository;
  learning: LearningRepository;
  learningStateQuery: LearningStateQueryRepository;
  tasks: LearningTaskRepository;
  rangerTrialSessions: RangerTrialSessionStore;
  createController(): RangerTrialSessionController;
}
