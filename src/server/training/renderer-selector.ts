import { LearningTaskType } from "@/domain/tasks/task-type";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import {
  MATCHING_GAME_TYPE,
  RANGER_TRIAL_GAME_TYPE,
  SNAKE_GAME_TYPE,
  WORD_BUBBLE_GAME_TYPE,
} from "@/server/auth/v1-user";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  TRAINING_RENDERERS,
  type TrainingRendererDefinition,
} from "./renderer-registry";

const MAX_SAME_RENDERER_STREAK = 2;

function preferenceOrder(task: PublicLearningTask): string[] {
  if (task.responseContract.kind === "TEXT_INPUT") {
    return [RANGER_TRIAL_GAME_TYPE];
  }
  switch (task.taskType) {
    case LearningTaskType.MEANING_CHOICE:
      return [WORD_BUBBLE_GAME_TYPE, SNAKE_GAME_TYPE, RANGER_TRIAL_GAME_TYPE];
    case LearningTaskType.RELATION_CHOICE:
      return [MATCHING_GAME_TYPE, WORD_BUBBLE_GAME_TYPE, RANGER_TRIAL_GAME_TYPE];
    case LearningTaskType.CONFUSABLE_CHOICE:
      return [MATCHING_GAME_TYPE, WORD_BUBBLE_GAME_TYPE, RANGER_TRIAL_GAME_TYPE];
    case LearningTaskType.ACTIVE_RECALL_TYPING:
    case LearningTaskType.SPELLING_RECALL_TYPING:
      return [RANGER_TRIAL_GAME_TYPE];
    default:
      return [RANGER_TRIAL_GAME_TYPE];
  }
}

function rankCompatible(
  task: PublicLearningTask,
  compatible: TrainingRendererDefinition[],
): TrainingRendererDefinition[] {
  const ranked: TrainingRendererDefinition[] = [];
  for (const gameType of preferenceOrder(task)) {
    const match = compatible.find((item) => item.gameType === gameType);
    if (match && !ranked.includes(match)) {
      ranked.push(match);
    }
  }
  for (const item of compatible) {
    if (!ranked.includes(item)) {
      ranked.push(item);
    }
  }
  return ranked;
}

/**
 * Deterministic application policy. Inspects PublicLearningTask only.
 * Does not read the private grading payload or change task semantics.
 */
export function selectRendererForTask(input: {
  task: PublicLearningTask;
  availableRenderers?: TrainingRendererDefinition[];
  recentRendererTypes?: string[];
}): TrainingRendererDefinition {
  const registry = input.availableRenderers ?? TRAINING_RENDERERS;
  const compatible = registry.filter((item) => item.canRenderTask(input.task));
  if (compatible.length === 0) {
    throw new GameSessionError(
      "NO_COMPATIBLE_RENDERER",
      "No registered renderer can present this task",
      { taskType: input.task.taskType },
    );
  }
  const ranked = rankCompatible(input.task, compatible);
  const recent = input.recentRendererTypes ?? [];
  const last = recent[recent.length - 1];
  const previous = recent[recent.length - 2];
  if (
    recent.length >= MAX_SAME_RENDERER_STREAK &&
    last === previous &&
    ranked[0]?.gameType === last &&
    ranked.length > 1
  ) {
    return ranked[1];
  }
  return ranked[0];
}
