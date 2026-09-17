import { Button } from "@/components/ui/button";
import type { RangerTrialSessionStats } from "@/server/game-session/ranger-trial-session.types";

export function RangerTrialComplete({
  stats,
  onPlayAgain,
}: {
  stats: RangerTrialSessionStats;
  onPlayAgain: () => void;
}) {
  return (
    <div className="ranger-feedback-in flex flex-col gap-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">闯关完成</h1>
        <p className="text-muted-foreground text-sm">这一轮练习结束了。</p>
      </div>
      <ul className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3 text-sm">
        <li className="rounded-2xl bg-white px-3 py-4 shadow-sm ring-1 ring-black/8">
          <div className="text-muted-foreground">完成</div>
          <div className="mt-1 text-2xl font-semibold">{stats.attempted}</div>
        </li>
        <li className="rounded-2xl bg-white px-3 py-4 shadow-sm ring-1 ring-black/8">
          <div className="text-muted-foreground">正确</div>
          <div className="mt-1 text-2xl font-semibold">{stats.correct}</div>
        </li>
        <li className="rounded-2xl bg-white px-3 py-4 shadow-sm ring-1 ring-black/8">
          <div className="text-muted-foreground">错误</div>
          <div className="mt-1 text-2xl font-semibold">{stats.incorrect}</div>
        </li>
      </ul>
      <Button
        type="button"
        className="h-12 w-full rounded-2xl text-base"
        onClick={onPlayAgain}
      >
        继续练习
      </Button>
    </div>
  );
}
