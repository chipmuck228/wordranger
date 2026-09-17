import {
  formatTaskPrompt,
  instructionForTaskType,
} from "@/components/game/shared/task-prompt-copy";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { SnakePresentation } from "./types";

/**
 * Public-task-only adapter. No AnswerKey, no correctness.
 */
export function snakePresentationFromTask(
  task: PublicLearningTask,
): SnakePresentation | null {
  if (task.responseContract.kind !== "CHOICE") {
    return null;
  }
  const formatted = formatTaskPrompt(task.prompt);
  return {
    instruction: formatted.instruction ?? instructionForTaskType(task.taskType),
    promptText: formatted.headline,
    options: task.responseContract.options.map((option) => ({
      id: option.id,
      text: option.content.text,
    })),
  };
}
