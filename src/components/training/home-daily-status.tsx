"use client";

import { useSyncExternalStore } from "react";
import { DAILY_TRAINING_COMPLETED_ROUNDS_KEY } from "./training-session-storage";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readRounds(): number {
  const raw = sessionStorage.getItem(DAILY_TRAINING_COMPLETED_ROUNDS_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function serverSnapshot(): number {
  return 0;
}

export function HomeDailyStatus() {
  const rounds = useSyncExternalStore(subscribe, readRounds, serverSnapshot);
  return (
    <p className="text-muted-foreground text-sm">
      {rounds < 1
        ? "今天还没有完成练习"
        : `今天已完成 ${rounds} 组练习`}
    </p>
  );
}
