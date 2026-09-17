import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { BubbleArena } from "./BubbleArena";
import { BubbleProgress } from "./BubbleProgress";
import { BubblePrompt } from "./BubblePrompt";
import type { StudentActionIntent } from "./types";

export function WordBubble({
  task,
  current,
  total,
  disabled,
  selectedOptionId,
  result,
  showProgress = true,
  onAction,
}: {
  task: PublicLearningTask;
  current: number;
  total: number;
  disabled?: boolean;
  selectedOptionId?: string | null;
  result?: "correct" | "incorrect";
  showProgress?: boolean;
  onAction(intent: StudentActionIntent): void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {showProgress ? <BubbleProgress current={current} total={total} /> : null}
      <BubblePrompt task={task} />
      <BubbleArena
        task={task}
        disabled={disabled}
        selectedOptionId={selectedOptionId}
        result={result}
        onSelect={(optionId) => onAction({ kind: "CHOICE", optionId })}
      />
    </div>
  );
}
