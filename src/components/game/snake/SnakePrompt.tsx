export function SnakePrompt({
  instruction,
  promptText,
}: {
  instruction: string;
  promptText: string;
}) {
  return (
    <div className="space-y-2 text-center">
      <p className="text-muted-foreground text-sm">{instruction}</p>
      <p className="text-3xl font-semibold tracking-tight">{promptText}</p>
    </div>
  );
}
