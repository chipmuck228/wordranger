import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { GameSessionStats } from "@/server/game-session/learning-game-session.types";

export function TrainingComplete(props: {
  stats: GameSessionStats;
  recapWords: string[];
  onPlayAgain: () => void;
}) {
  return (
    <div className="flex flex-col gap-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">本组练习完成</h1>
      </div>
      <div className="space-y-1 text-lg">
        <p>完成 {props.stats.attempted} 个</p>
        <p>答对 {props.stats.correct} 个</p>
      </div>
      {props.recapWords.length > 0 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">今天多留意：</p>
          <p className="text-base font-medium">{props.recapWords.join("、")}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          className="h-12 w-full text-base"
          onClick={props.onPlayAgain}
        >
          再练一组
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          className="h-12 w-full text-base"
          render={<Link href="/" />}
        >
          回首页
        </Button>
      </div>
    </div>
  );
}
