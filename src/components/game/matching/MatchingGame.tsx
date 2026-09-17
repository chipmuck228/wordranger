import { useState } from "react";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { MatchingBoard } from "./MatchingBoard";
import { MatchingProgress } from "./MatchingProgress";
import { MatchingPrompt } from "./MatchingPrompt";
import { matchingPresentationFromTask } from "./matching-presentation";
import type { StudentActionIntent } from "./types";

export function MatchingGame({
  task,
  current,
  total,
  disabled,
  result,
  onAction,
}: {
  task: PublicLearningTask;
  current: number;
  total: number;
  disabled?: boolean;
  result?: "correct" | "incorrect";
  onAction(intent: StudentActionIntent): void;
}) {
  const presentation = matchingPresentationFromTask(task);
  const [interaction, setInteraction] = useState({
    taskId: task.id,
    selectedTarget: false,
    selectedOptionId: null as string | null,
    orderHint: false,
  });
  if (interaction.taskId !== task.id) {
    setInteraction({
      taskId: task.id,
      selectedTarget: false,
      selectedOptionId: null,
      orderHint: false,
    });
  }
  const { selectedTarget, selectedOptionId, orderHint } = interaction;

  if (!presentation) {
    return null;
  }

  function onSelectTarget(): void {
    if (disabled) {
      return;
    }
    setInteraction((current) => ({
      ...current,
      selectedTarget: true,
      orderHint: false,
    }));
  }

  function onSelectOption(optionId: string): void {
    if (disabled) {
      return;
    }
    if (!selectedTarget) {
      setInteraction((current) => ({
        ...current,
        orderHint: true,
      }));
      return;
    }
    setInteraction((current) => ({
      ...current,
      selectedOptionId: optionId,
      orderHint: false,
    }));
    onAction({ kind: "CHOICE", optionId });
  }

  return (
    <div className="flex flex-col gap-6">
      <MatchingProgress current={current} total={total} />
      <MatchingPrompt instruction={presentation.instruction} />
      {orderHint ? (
        <p className="text-center text-sm text-amber-700" role="status">
          先点左边的词。
        </p>
      ) : null}
      <MatchingBoard
        presentation={presentation}
        selectedTarget={selectedTarget}
        selectedOptionId={selectedOptionId}
        disabled={disabled}
        result={result}
        onSelectTarget={onSelectTarget}
        onSelectOption={onSelectOption}
      />
    </div>
  );
}
