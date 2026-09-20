import { Button } from "@/components/ui/button";
import type { ContextLabScreen } from "./types";

export function ContextLabRecordedNotice({
  screen,
  disabled,
  onContinue,
}: {
  screen: Extract<ContextLabScreen, { kind: "FROZEN_TASK_RECORDED" }>;
  disabled?: boolean;
  onContinue?: () => void;
}) {
  return (
    <section
      data-pilot-state="FROZEN_TASK_RECORDED"
      className="bg-card flex flex-1 flex-col justify-center gap-4 rounded-3xl p-5 text-center shadow-sm ring-1 ring-black/5"
    >
      <p className="text-base leading-relaxed">{screen.feedback.message}</p>
      <p className="text-sm leading-relaxed">{screen.recordedMessage}</p>
      {screen.continueAvailable && onContinue ? (
        <Button
          type="button"
          disabled={disabled}
          className="h-12 w-full min-h-12 rounded-2xl text-base"
          onClick={onContinue}
        >
          继续
        </Button>
      ) : null}
    </section>
  );
}
