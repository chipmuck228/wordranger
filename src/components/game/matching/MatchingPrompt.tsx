export function MatchingPrompt({ instruction }: { instruction: string }) {
  return (
    <p className="text-muted-foreground text-center text-sm">{instruction}</p>
  );
}
