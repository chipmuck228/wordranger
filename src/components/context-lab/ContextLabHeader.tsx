import {
  CONTEXT_LAB_HEADING_ID,
  formatContextLabProgress,
  formatContextLabProgressLabel,
  type ContextLabProgress,
} from "./types";

export function ContextLabHeader({
  title,
  settingLabel,
  progress,
}: {
  title: string;
  settingLabel: string;
  progress: ContextLabProgress;
}) {
  return (
    <header className="space-y-2">
      <p className="text-muted-foreground text-xs">Context Lab · Experimental</p>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1
            id={CONTEXT_LAB_HEADING_ID}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            {title}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {settingLabel}
          </p>
        </div>
        <p
          className="text-muted-foreground shrink-0 pt-1 text-sm tabular-nums"
          aria-label={formatContextLabProgressLabel(progress)}
        >
          {formatContextLabProgress(progress)}
        </p>
      </div>
    </header>
  );
}
