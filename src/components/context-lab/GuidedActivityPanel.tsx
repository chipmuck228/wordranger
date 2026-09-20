import { Button } from "@/components/ui/button";
import { MealSceneCard } from "./MealSceneCard";
import type { ContextLabScreen } from "./types";

export function GuidedActivityPanel({
  screen,
  onAcknowledge,
  disabled = false,
}: {
  screen: Extract<ContextLabScreen, { kind: "GUIDED" }>;
  onAcknowledge: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      data-strengthen-phase={screen.strengthenPhase}
      className="flex min-w-0 flex-1 flex-col gap-6"
    >
      <MealSceneCard context={screen.context} />
      <Button
        type="button"
        disabled={disabled}
        className="h-12 w-full min-h-12 rounded-2xl text-base"
        onClick={onAcknowledge}
      >
        {screen.acknowledgeLabel ?? "继续"}
      </Button>
    </div>
  );
}
