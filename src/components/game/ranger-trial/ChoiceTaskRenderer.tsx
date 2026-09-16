import { TaskPromptView } from "@/components/game/shared/TaskPromptView";
import type { LearningTaskRendererProps } from "./types";

export function ChoiceTaskRenderer({
  task,
  disabled,
  onAction,
}: LearningTaskRendererProps) {
  if (task.responseContract.kind !== "CHOICE") {
    return null;
  }
  return (
    <div className="flex flex-col gap-6">
      <TaskPromptView prompt={task.prompt} taskType={task.taskType} />
      <div className="flex flex-col gap-3" role="group" aria-label="选项">
        {task.responseContract.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onAction({ kind: "CHOICE", optionId: option.id })}
            className="min-h-12 rounded-xl border border-border bg-card px-4 py-3 text-left text-base leading-snug shadow-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            {option.content.text}
          </button>
        ))}
      </div>
    </div>
  );
}
