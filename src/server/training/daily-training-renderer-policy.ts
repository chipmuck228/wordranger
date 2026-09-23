import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { DIRECT_PRACTICE_PRESENTATION_TYPE } from "@/server/auth/v1-user";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  DAILY_TRAINING_DIRECT_RENDERER,
  type TrainingRendererDefinition,
} from "./renderer-registry";

/** Student-facing /train always shows direct practice. Stored game types stay on the item for Evidence. */
export function dailyTrainingPresentationType(
  stored: string | null | undefined,
): string | null {
  if (!stored) {
    return null;
  }
  return DIRECT_PRACTICE_PRESENTATION_TYPE;
}

/**
 * Daily Training presentation policy. Always returns the direct
 * practice renderer. Does not read recent-renderer streak, private
 * grading fields, or targetSkill alone. The generic
 * `selectRendererForTask` registry stays for free-play and injected
 * compatibility tests.
 */
export function selectDailyTrainingRenderer(input: {
  task: PublicLearningTask;
  availableRenderers?: TrainingRendererDefinition[];
  recentRendererTypes?: string[];
}): TrainingRendererDefinition {
  if (!DAILY_TRAINING_DIRECT_RENDERER.canRenderTask(input.task)) {
    throw new GameSessionError(
      "NO_COMPATIBLE_RENDERER",
      "Direct practice cannot present this task",
      { taskType: input.task.taskType },
    );
  }
  return DAILY_TRAINING_DIRECT_RENDERER;
}
