import { Button } from "@/components/ui/button";
import type { GameSubmissionFeedback } from "@/server/game-session/ranger-trial-session.types";

function detailText(
  feedback: GameSubmissionFeedback,
  correct: boolean,
): string | null {
  const message = feedback.message.trim();
  if (!message) {
    return null;
  }
  if (correct && /^答对了！?$/.test(message)) {
    return null;
  }
  if (!correct && /^再看看！?$/.test(message)) {
    return null;
  }
  return message;
}

export function InlineTrainingFeedback({
  feedback,
  onContinue,
  disabled,
  continueLabel = "下一题",
  hideCorrection = false,
  title,
}: {
  feedback: GameSubmissionFeedback;
  onContinue: () => void;
  disabled?: boolean;
  continueLabel?: string;
  hideCorrection?: boolean;
  title?: string;
}) {
  const correct =
    feedback.status === "CORRECT" || feedback.status === "ASSISTED";
  const detail = title ? null : detailText(feedback, correct);
  const showCorrection =
    !hideCorrection &&
    Boolean(feedback.correction?.text) &&
    !feedback.message.includes(feedback.correction?.text ?? "") &&
    detail !== `正确答案：${feedback.correction?.text}`;
  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-live="polite"
      data-feedback-status={feedback.status}
    >
      <div
        className={`rounded-xl px-4 py-3 text-sm ring-1 ${
          correct
            ? "bg-emerald-50 text-emerald-950 ring-emerald-200/80"
            : "bg-rose-50 text-rose-950 ring-rose-200/80"
        }`}
      >
        <p className="font-medium">{title ?? (correct ? "答对了" : "再看看")}</p>
        {detail ? (
          <p className="mt-1 text-base font-semibold tracking-tight">{detail}</p>
        ) : null}
        {showCorrection ? (
          <p className="mt-1 text-sm">正确答案：{feedback.correction?.text}</p>
        ) : null}
      </div>
      <Button
        type="button"
        className="h-11 shrink-0 rounded-xl px-5 text-sm sm:min-w-28"
        onClick={onContinue}
        disabled={disabled || !feedback.continueAvailable}
      >
        {continueLabel}
      </Button>
    </div>
  );
}
