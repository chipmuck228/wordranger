import { ChoiceTaskRenderer } from "@/components/game/ranger-trial/ChoiceTaskRenderer";
import { TextInputTaskRenderer } from "@/components/game/ranger-trial/TextInputTaskRenderer";
import { MealSceneCard } from "./MealSceneCard";
import type { ContextLabScreen } from "./types";

export function FrozenTaskPreview({
  screen,
  disabled = false,
  onAction,
}: {
  screen: Extract<ContextLabScreen, { kind: "FROZEN_TASK_PREVIEW" }>;
  disabled?: boolean;
  onAction: (
    intent:
      | { kind: "TEXT_INPUT"; value: string }
      | { kind: "CHOICE"; optionId: string },
  ) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <MealSceneCard context={screen.context} />
      {screen.task.responseContract.kind === "CHOICE" ? (
        <ChoiceTaskRenderer
          task={screen.task}
          disabled={disabled}
          onAction={onAction}
        />
      ) : (
        <TextInputTaskRenderer
          task={screen.task}
          disabled={disabled}
          onAction={onAction}
        />
      )}
    </div>
  );
}
