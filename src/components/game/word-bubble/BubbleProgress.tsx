export function BubbleProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      泡泡进度 {current} / {total}
    </p>
  );
}
