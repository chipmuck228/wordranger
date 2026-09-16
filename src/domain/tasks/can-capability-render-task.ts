import type { GameCapability } from "@/domain/learning/game-capability";
import type { PublicLearningTask } from "./public-learning-task";

export function canCapabilityRenderTask(
  capability: GameCapability,
  task: PublicLearningTask,
): boolean {
  if (!capability.supportedSkills.includes(task.targetSkill)) {
    return false;
  }
  if (!capability.supportedPromptModes.includes(task.promptMode)) {
    return false;
  }
  if (!capability.supportedAnswerModes.includes(task.answerMode)) {
    return false;
  }
  if (
    task.difficulty < capability.difficultyRange.min ||
    task.difficulty > capability.difficultyRange.max
  ) {
    return false;
  }
  return true;
}
