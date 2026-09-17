export function MatchingTargetCard({
  text,
  selected,
  disabled,
  result,
  onSelect,
}: {
  text: string;
  selected: boolean;
  disabled?: boolean;
  result?: "correct" | "incorrect";
  onSelect(): void;
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
      aria-label={`目标：${text}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`min-h-16 w-full rounded-2xl border px-4 py-5 text-center text-2xl font-semibold tracking-tight break-words shadow-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none sm:text-3xl ${selected ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300" : "border-border bg-card hover:bg-muted"} ${resultClass}`}
    >
      {text}
    </button>
  );
}
