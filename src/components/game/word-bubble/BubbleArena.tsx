import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { layoutBubbleOptions } from "./bubble-layout";
import { BubbleOption } from "./BubbleOption";

export function BubbleArena({
  task,
  disabled,
  selectedOptionId,
  result,
  onSelect,
}: {
  task: PublicLearningTask;
  disabled?: boolean;
  selectedOptionId?: string | null;
  result?: "correct" | "incorrect";
  onSelect(optionId: string): void;
}) {
  if (task.responseContract.kind !== "CHOICE") {
    return null;
  }
  const options = task.responseContract.options;
  const layouts = layoutBubbleOptions(
    task.id,
    options.map((option) => option.id),
  );
  const byId = new Map(layouts.map((layout) => [layout.optionId, layout]));
  return (
    <div
      className="relative isolate h-[min(62vh,28rem)] w-full overflow-hidden rounded-3xl border border-sky-100 bg-linear-to-b from-sky-50 to-background"
      role="group"
      aria-label="单词泡泡"
    >
      {options.map((option) => {
        const layout = byId.get(option.id);
        if (!layout) {
          return null;
        }
        const selected = selectedOptionId === option.id;
        return (
          <BubbleOption
            key={option.id}
            optionId={option.id}
            text={option.content.text}
            layout={layout}
            disabled={disabled}
            selected={selected}
            result={
              selected && result
                ? result
                : undefined
            }
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
