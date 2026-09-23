import { Button } from "@/components/ui/button";
import type { GameSubmissionFeedback } from "@/server/game-session/ranger-trial-session.types";

export function TaskFeedback({
  feedback,
  onContinue,
  disabled,
  continueLabel = "继续",
}: {
  feedback: GameSubmissionFeedback;
  onContinue: () => void;
  disabled?: boolean;
  continueLabel?: string;
}) {
  const correct =
    feedback.status === "CORRECT" || feedback.status === "ASSISTED";
  const tone = correct ? "答对了" : "再看看";
  return (
    <div
      className="ranger-feedback-in flex flex-col gap-6"
      role="status"
      aria-live="polite"
      data-feedback-status={feedback.status}
    >
      <div
        className={`rounded-2xl px-5 py-5 text-center ring-1 ${
          correct
            ? "bg-emerald-50 text-emerald-950 ring-emerald-200/80"
            : "bg-rose-50 text-rose-950 ring-rose-200/80"
        }`}
      >
        <p className="text-sm font-medium opacity-80">{tone}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {feedback.message}
        </p>
        {feedback.correction?.text &&
        !feedback.message.includes(feedback.correction.text) ? (
          <p className="mt-3 text-base font-medium">
            正确答案：{feedback.correction.text}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        className="h-12 w-full rounded-2xl text-base"
        onClick={onContinue}
        disabled={disabled || !feedback.continueAvailable}
      >
        {continueLabel}
      </Button>
    </div>
  );
}
