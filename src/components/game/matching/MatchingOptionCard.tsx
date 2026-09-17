export function MatchingOptionCard({
  optionId,
  text,
  selected,
  disabled,
  result,
  onSelect,
}: {
  optionId: string;
  text: string;
  selected: boolean;
  disabled?: boolean;
  result?: "correct" | "incorrect";
  onSelect(optionId: string): void;
}) {
  const resultClass =
    result === "correct"
      ? "matching-card-pop"
      : result === "incorrect"
        ? "matching-card-shake"
        : "";
  return (
    <button
      type="button"
      data-option-id={optionId}
      aria-label={text}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(optionId)}
      className={`min-h-12 w-full rounded-xl border px-4 py-3 text-left text-base leading-snug break-words shadow-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none ${selected ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300" : "border-border bg-card hover:bg-muted"} ${resultClass}`}
    >
      {text}
    </button>
  );
}
