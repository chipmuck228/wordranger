import { Button } from "@/components/ui/button";
import { MealSceneCard } from "./MealSceneCard";
import type { ContextLabScreen } from "./types";

export function ProbeSummaryPanel({
  screen,
  disabled,
  onHandoff,
}: {
  screen: Extract<ContextLabScreen, { kind: "PROBE_SUMMARY" }>;
  disabled?: boolean;
  onHandoff: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <MealSceneCard context={screen.context} />
      <ul className="space-y-3">
        {screen.items.map((item) => (
          <li
            key={item.entityId}
            className="bg-card rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ring-1 ring-black/5"
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground"> → {item.summary}</span>
          </li>
        ))}
      </ul>
      {screen.pendingMessage ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {screen.pendingMessage}
        </p>
      ) : null}
      {screen.canHandoffToBuild ? (
        <Button
          type="button"
          disabled={disabled}
          className="h-12 w-full min-h-12 rounded-2xl text-base"
          onClick={onHandoff}
        >
          开始勺子教学
        </Button>
      ) : null}
    </div>
  );
}
