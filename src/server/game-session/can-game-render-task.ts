import type { GameCapability } from "@/domain/learning/game-capability";
import { canCapabilityRenderTask } from "@/domain/tasks/can-capability-render-task";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { LearningGameDefinition } from "./game-definition";
import { GameSessionError } from "./ranger-trial-errors";

export function canGameRenderTask(
  capability: GameCapability,
  task: PublicLearningTask,
): boolean {
  if (!canCapabilityRenderTask(capability, task)) {
    return false;
  }
  return (
    task.responseContract.kind === "CHOICE" ||
    task.responseContract.kind === "TEXT_INPUT"
  );
}

export function assertGameCanRender(
  definition: LearningGameDefinition,
  task: PublicLearningTask,
): void {
  if (definition.canRenderTask(task)) {
    return;
  }
  throw new GameSessionError(
    "GAME_CANNOT_RENDER_TASK",
    `${definition.gameType} cannot render ${task.taskType}`,
    {
      gameType: definition.gameType,
      taskType: task.taskType,
      promptMode: task.promptMode,
      answerMode: task.answerMode,
      responseKind: task.responseContract.kind,
    },
  );
}
