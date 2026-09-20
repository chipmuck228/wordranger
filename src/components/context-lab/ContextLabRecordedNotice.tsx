import type { ContextLabScreen } from "./types";

export function ContextLabRecordedNotice({
  screen,
}: {
  screen: Extract<ContextLabScreen, { kind: "FROZEN_TASK_RECORDED" }>;
}) {
  return (
    <section
      data-pilot-state="FROZEN_TASK_RECORDED"
      className="bg-card flex flex-1 flex-col justify-center gap-4 rounded-3xl p-5 text-center shadow-sm ring-1 ring-black/5"
    >
      <p className="text-base leading-relaxed">{screen.feedback.message}</p>
      <p className="text-sm leading-relaxed">{screen.recordedMessage}</p>
    </section>
  );
}
