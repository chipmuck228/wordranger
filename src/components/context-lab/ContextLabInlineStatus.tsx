import { Button } from "@/components/ui/button";
import {
  CONTEXT_LAB_AUTO_CONTINUE_FAILED_MESSAGE,
  CONTEXT_LAB_INLINE_RECORDED_STATUS,
} from "./types";

export function ContextLabInlineStatus({
  status,
  message,
  screenKind,
  onRetry,
}: {
  status: "RECORDED" | "CONTINUE_FAILED";
  message: string;
  screenKind: "PROBE_TASK_RECORDED" | "FROZEN_TASK_RECORDED";
  onRetry?: () => void;
}) {
  return (
    <section
      data-pilot-state={screenKind}
      data-inline-status={status}
      className="bg-muted/60 flex min-w-0 flex-col gap-3 rounded-2xl px-4 py-3"
    >
      <p aria-live="polite" aria-atomic="true" className="text-sm leading-relaxed">
        {status === "CONTINUE_FAILED"
          ? CONTEXT_LAB_AUTO_CONTINUE_FAILED_MESSAGE
          : message}
      </p>
      {status === "CONTINUE_FAILED" && onRetry ? (
        <Button
          type="button"
          className="h-12 w-full min-h-12 rounded-2xl text-base"
          onClick={onRetry}
        >
          重试
        </Button>
      ) : null}
    </section>
  );
}

export function inlineRecordedCopy(input: {
  kind: "PROBE_TASK_RECORDED" | "FROZEN_TASK_RECORDED";
  recordedMessage?: string;
}): string {
  if (input.kind === "PROBE_TASK_RECORDED") {
    return CONTEXT_LAB_INLINE_RECORDED_STATUS;
  }
  return input.recordedMessage ?? CONTEXT_LAB_INLINE_RECORDED_STATUS;
}
