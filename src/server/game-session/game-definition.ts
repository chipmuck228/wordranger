import type { GameCapability } from "@/domain/learning/game-capability";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";

export interface LearningGameDefinition {
  gameType: string;
  gameId: string;
  capability: GameCapability;
  canRenderTask(task: PublicLearningTask): boolean;
  requestedNeedCount: number;
}
