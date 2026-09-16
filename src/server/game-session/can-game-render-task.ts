import type { GameCapability } from "@/domain/learning/game-capability";
import { canCapabilityRenderTask } from "@/domain/tasks/can-capability-render-task";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { RANGER_TRIAL_CAPABILITY } from "./ranger-trial-capability";
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

export function assertRangerTrialCanRender(task: PublicLearningTask): void {
  if (canGameRenderTask(RANGER_TRIAL_CAPABILITY, task)) {
    return;
  }
  throw new GameSessionError(
    "GAME_CANNOT_RENDER_TASK",
    `Ranger Trial cannot render ${task.taskType}`,
    {
      gameType: RANGER_TRIAL_CAPABILITY.gameType,
      taskType: task.taskType,
      promptMode: task.promptMode,
      answerMode: task.answerMode,
      responseKind: task.responseContract.kind,
    },
  );
}
