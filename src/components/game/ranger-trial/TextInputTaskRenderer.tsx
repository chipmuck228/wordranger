import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskPromptView } from "./TaskPromptView";
import type { LearningTaskRendererProps } from "./types";

export function TextInputTaskRenderer({
  task,
  disabled,
  onAction,
}: LearningTaskRendererProps) {
  const [value, setValue] = useState("");
  if (task.responseContract.kind !== "TEXT_INPUT") {
    return null;
  }
  const placeholder = task.responseContract.placeholder ?? "输入英文单词";
  const maxLength = task.responseContract.maxLength;
  const canSubmit = value.trim().length > 0 && !disabled;

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onAction({ kind: "TEXT_INPUT", value });
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <TaskPromptView prompt={task.prompt} taskType={task.taskType} />
      <div className="flex flex-col gap-3">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="英文答案"
          className="h-12 text-center text-lg"
        />
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full text-base"
        >
          提交
        </Button>
      </div>
    </form>
  );
}
