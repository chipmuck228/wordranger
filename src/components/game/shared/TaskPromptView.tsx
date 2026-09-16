import type { TaskPrompt } from "@/domain/tasks/learning-task";
import type { LearningTaskType } from "@/domain/tasks/task-type";
import {
  formatTaskPrompt,
  instructionForTaskType,
} from "./task-prompt-copy";

export function TaskPromptView({
  prompt,
  taskType,
}: {
  prompt: TaskPrompt;
  taskType: LearningTaskType;
}) {
  const formatted = formatTaskPrompt(prompt);
  const instruction =
    formatted.instruction ?? instructionForTaskType(taskType);
  return (
    <div className="space-y-3 text-center">
      <p className="text-muted-foreground text-sm">{instruction}</p>
      <p className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">
        {formatted.headline}
      </p>
    </div>
  );
}
