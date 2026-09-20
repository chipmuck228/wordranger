import { Button } from "@/components/ui/button";
import { MealSceneCard } from "./MealSceneCard";
import type { ContextLabScreen } from "./types";

export function GuidedActivityPanel({
  screen,
  onAcknowledge,
}: {
  screen: Extract<ContextLabScreen, { kind: "GUIDED" }>;
  onAcknowledge: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <MealSceneCard context={screen.context} />
      <Button
        type="button"
        className="h-12 w-full min-h-12 rounded-2xl text-base"
        onClick={onAcknowledge}
      >
        继续
      </Button>
    </div>
  );
}
