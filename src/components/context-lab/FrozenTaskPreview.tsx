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
  const showScene = screen.presentationMode !== "TASK_ONLY";
  return (
    <div
      data-presentation-mode={screen.presentationMode ?? "SCENE_TARGET"}
      data-strengthen-phase={screen.strengthenPhase}
      className="flex min-w-0 flex-1 flex-col gap-6"
    >
      {showScene ? (
        <MealSceneCard context={screen.context} />
      ) : (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {screen.context.instruction}
        </p>
      )}
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
