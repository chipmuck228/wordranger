import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ContextLabShell({
  children,
  transitioning,
  onRestart,
}: {
  children: ReactNode;
  transitioning?: boolean;
  onRestart?: () => void;
}) {
  return (
    <main
      lang="zh-CN"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <div
        className={cn(
          "flex flex-1 flex-col gap-6",
          transitioning && "motion-safe:opacity-70 motion-safe:transition-opacity",
        )}
      >
        {children}
      </div>
      {onRestart ? (
        <Button
          type="button"
          variant="ghost"
          className="h-11 min-h-11 self-center px-4 text-sm"
          onClick={onRestart}
        >
          重新体验
        </Button>
      ) : null}
    </main>
  );
}
