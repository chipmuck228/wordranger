import type { BubbleLayoutPosition } from "./types";

export function BubbleOption({
  optionId,
  text,
  layout,
  disabled,
  selected,
  result,
  onSelect,
}: {
  optionId: string;
  text: string;
  layout: BubbleLayoutPosition;
  disabled?: boolean;
  selected?: boolean;
  result?: "correct" | "incorrect";
  onSelect(optionId: string): void;
}) {
  const motionClass =
    result === "correct"
      ? "word-bubble-pop"
      : result === "incorrect"
        ? "word-bubble-shake"
        : "word-bubble-float";
  return (
    <button
      type="button"
      data-option-id={optionId}
      disabled={disabled}
      aria-label={text}
      onClick={() => onSelect(optionId)}
      className={`word-bubble-option absolute z-10 flex max-h-[42%] max-w-[46%] min-h-12 min-w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-sky-200/80 bg-sky-50/95 px-3 py-3 text-center text-sm leading-snug font-medium text-sky-950 shadow-sm transition-opacity hover:bg-sky-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-70 sm:max-w-[38%] sm:text-base ${motionClass} ${selected ? "z-20 ring-2 ring-sky-400" : ""}`}
      style={{
        left: `${layout.x}%`,
        top: `${layout.y}%`,
        animationDelay: `${layout.delayMs}ms`,
        animationDuration: `${layout.durationMs}ms`,
        ["--bubble-dx" as string]: layout.driftX,
        ["--bubble-dy" as string]: layout.driftY,
      }}
    >
      <span className="break-words">{text}</span>
    </button>
  );
}
