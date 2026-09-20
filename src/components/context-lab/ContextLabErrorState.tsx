import type { ContextLabScreen } from "./types";

export function ContextLabErrorState({
  screen,
}: {
  screen: Extract<ContextLabScreen, { kind: "ERROR" }>;
}) {
  return (
    <section className="flex flex-1 flex-col justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold">{screen.title}</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {screen.message}
      </p>
      <p className="text-muted-foreground text-xs">{screen.code}</p>
    </section>
  );
}
