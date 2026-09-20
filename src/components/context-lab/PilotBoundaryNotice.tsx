import type { ContextLabScreen } from "./types";

export function PilotBoundaryNotice({
  screen,
}: {
  screen: Extract<ContextLabScreen, { kind: "FROZEN_TASK_HANDOFF_READY" }>;
}) {
  return (
    <section
      data-pilot-state="FROZEN_TASK_HANDOFF_READY"
      className="bg-card flex flex-1 flex-col justify-center gap-4 rounded-3xl p-5 text-center shadow-sm ring-1 ring-black/5"
    >
      {screen.message.split("\n").map((line) => (
        <p key={line} className="text-sm leading-relaxed">
          {line}
        </p>
      ))}
    </section>
  );
}
