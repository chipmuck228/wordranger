export function TaskProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      闯关进度 {current} / {total}
    </p>
  );
}
