export function TaskProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(1, Math.max(0, current / safeTotal));
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        闯关进度 {current} / {total}
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-black/5"
        aria-hidden="true"
      >
        <div
          className="ranger-progress-fill h-full rounded-full bg-primary"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
