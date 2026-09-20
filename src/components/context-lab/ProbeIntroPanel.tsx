import { Button } from "@/components/ui/button";
import { MealSceneCard } from "./MealSceneCard";
import type { ContextLabScreen } from "./types";

export function ProbeIntroPanel({
  screen,
  disabled,
  onContinue,
}: {
  screen: Extract<ContextLabScreen, { kind: "PROBE_INTRO" }>;
  disabled?: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <MealSceneCard context={screen.context} />
      <Button
        type="button"
        disabled={disabled}
        className="h-12 w-full min-h-12 rounded-2xl text-base"
        onClick={onContinue}
      >
        开始检查
      </Button>
    </div>
  );
}
