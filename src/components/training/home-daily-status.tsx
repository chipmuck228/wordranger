"use client";

import { useSyncExternalStore } from "react";
import {
  readCompletedDailyTrainingRounds,
  subscribeDailyTrainingStatus,
} from "./training-session-storage";

function serverSnapshot(): number {
  return 0;
}

export function HomeDailyStatus() {
  const rounds = useSyncExternalStore(
    subscribeDailyTrainingStatus,
    readCompletedDailyTrainingRounds,
    serverSnapshot,
  );
  return (
    <p className="text-muted-foreground text-sm">
      {rounds < 1
        ? "今天还没有完成练习"
        : `今天已完成 ${rounds} 组练习`}
    </p>
  );
}
