export function MatchingProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      连连看进度 {current} / {total}
    </p>
  );
}
