import { Button } from "@/components/ui/button";
import type { GameSubmissionFeedback } from "@/server/game-session/learning-game-session.types";

export function SnakeFeedback({
  feedback,
  onContinue,
  disabled,
}: {
  feedback: GameSubmissionFeedback;
  onContinue: () => void;
  disabled?: boolean;
}) {
  const tone =
    feedback.status === "CORRECT" || feedback.status === "ASSISTED"
      ? "答对了"
      : "需要订正";
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <div className="space-y-2 text-center">
        <p className="text-muted-foreground text-sm">{tone}</p>
        <p className="text-2xl font-semibold tracking-tight">
          {feedback.message}
        </p>
        {feedback.correction?.text ? (
          <p className="text-muted-foreground text-base">
            {feedback.correction.text}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        className="h-12 w-full text-base"
        onClick={onContinue}
        disabled={disabled || !feedback.continueAvailable}
      >
        继续
      </Button>
    </div>
  );
}
