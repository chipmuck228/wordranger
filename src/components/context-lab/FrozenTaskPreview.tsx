import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskPromptView } from "@/components/game/shared/TaskPromptView";
import { MealSceneCard } from "./MealSceneCard";
import type { ContextLabScreen } from "./types";

export function FrozenTaskPreview({
  screen,
  value,
  onValueChange,
  onOpenBoundary,
}: {
  screen: Extract<ContextLabScreen, { kind: "FROZEN_TASK_PREVIEW" }>;
  value: string;
  onValueChange: (value: string) => void;
  onOpenBoundary: () => void;
}) {
  const placeholder =
    screen.task.responseContract.kind === "TEXT_INPUT"
      ? (screen.task.responseContract.placeholder ?? "输入英文单词")
      : "输入英文单词";
  const maxLength =
    screen.task.responseContract.kind === "TEXT_INPUT"
      ? screen.task.responseContract.maxLength
      : undefined;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <MealSceneCard context={screen.context} />
      <div className="[&_p:last-child]:text-xl [&_p:last-child]:leading-snug sm:[&_p:last-child]:text-2xl">
        <TaskPromptView prompt={screen.task.prompt} taskType={screen.task.taskType} />
      </div>
      <div className="flex flex-col gap-3">
        <Input
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onValueChange(event.target.value)
          }
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="英文答案预览"
          className="h-14 rounded-2xl text-center text-lg shadow-sm"
        />
        <Button
          type="button"
          className="h-12 w-full min-h-12 rounded-2xl text-base"
          onClick={onOpenBoundary}
        >
          提交功能将在下一阶段接入
        </Button>
      </div>
    </div>
  );
}
