import { MatchingOptionCard } from "./MatchingOptionCard";
import { MatchingTargetCard } from "./MatchingTargetCard";
import type { MatchingPresentation } from "./types";

export function MatchingBoard({
  presentation,
  selectedTarget,
  selectedOptionId,
  disabled,
  result,
  onSelectTarget,
  onSelectOption,
}: {
  presentation: MatchingPresentation;
  selectedTarget: boolean;
  selectedOptionId: string | null;
  disabled?: boolean;
  result?: "correct" | "incorrect";
  onSelectTarget(): void;
  onSelectOption(optionId: string): void;
}) {
  const connected = selectedTarget && Boolean(selectedOptionId);
  return (
    <div
      className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start"
      role="group"
      aria-label="连连看棋盘"
    >
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs">左边</p>
        <MatchingTargetCard
          text={presentation.targetText}
          selected={selectedTarget}
          disabled={disabled}
          result={result}
          onSelect={onSelectTarget}
        />
      </div>
      <div
        className={`matching-connector hidden h-full min-h-16 w-8 self-center md:block ${connected ? "matching-connector-on" : ""}`}
        aria-hidden
      />
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs">右边</p>
        <div className="flex flex-col gap-3" role="group" aria-label="候选">
          {presentation.options.map((option) => (
            <MatchingOptionCard
              key={option.id}
              optionId={option.id}
              text={option.text}
              selected={selectedOptionId === option.id}
              disabled={disabled}
              result={
                selectedOptionId === option.id ? result : undefined
              }
              onSelect={onSelectOption}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
