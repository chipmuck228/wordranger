"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { HomeDailyStatus } from "@/components/training/home-daily-status";
import { hasIncompleteDailyTrainingSession } from "@/components/training/training-session-storage";
import type { HomeLearningPaths } from "@/server/home/resolve-home-learning-paths";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readIncomplete(): boolean {
  return hasIncompleteDailyTrainingSession();
}

function serverSnapshot(): boolean {
  return false;
}

export function HomePracticeEntry({ href }: { href: HomeLearningPaths["primaryHref"] }) {
  const continuing = useSyncExternalStore(
    subscribe,
    readIncomplete,
    serverSnapshot,
  );
  const label = continuing ? "继续自由练习" : "开始自由练习";
  return (
    <div className="mt-8 flex max-w-md flex-col gap-3">
      <Link
        href={href}
        className={`bg-primary text-primary-foreground hover:bg-primary/80 inline-flex min-h-14 items-center justify-center rounded-xl px-6 text-lg font-medium ${FOCUS}`}
      >
        {label}
      </Link>
      <p className="text-muted-foreground text-sm">
        单词由系统根据当前学习情况安排。
      </p>
      <HomeDailyStatus />
    </div>
  );
}
