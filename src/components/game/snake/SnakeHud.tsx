export function SnakeHud({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      贪食蛇进度 {current} / {total}
    </p>
  );
}
