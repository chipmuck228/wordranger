"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RangerTrial } from "@/components/game/ranger-trial/RangerTrial";
import { RangerTrialComplete } from "@/components/game/ranger-trial/RangerTrialComplete";
import { RangerTrialSettingsPanel } from "@/components/game/ranger-trial/RangerTrialSettingsPanel";
import { TaskFeedback } from "@/components/game/ranger-trial/TaskFeedback";
import { TaskProgress } from "@/components/game/ranger-trial/TaskProgress";
import {
  DEFAULT_RANGER_TRIAL_UI_SETTINGS,
  RANGER_TRIAL_ROUND_SIZE,
  getRangerTrialSettingsSnapshot,
  saveRangerTrialSettings,
  subscribeRangerTrialSettings,
  type RangerTrialUiSettings,
} from "@/components/game/ranger-trial/ranger-trial-settings";
import { GameSessionErrorPanel } from "@/components/game/shared/GameSessionErrorPanel";
import { withClientGameTimeout } from "@/components/game/shared/bounded-game-operation";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { StudentActionIntent } from "@/components/game/ranger-trial/types";
import { GAME_SESSION_USER_MESSAGES } from "@/server/game-session/ranger-trial-errors";
import type {
  GameSubmissionFeedback,
  RangerTrialPublicSession,
  RangerTrialSessionStats,
} from "@/server/game-session/ranger-trial-session.types";
import {
  continueRangerTrialSession,
  resumeRangerTrialSession,
  startRangerTrialSession,
  submitRangerTrialAction,
} from "./actions";

const SESSION_KEY = "wordranger.ranger-trial.sessionId";

type Screen =
  | "start"
  | "loading"
  | "playing"
  | "submitting"
  | "feedback"
  | "continuing"
  | "complete"
  | "error"
  | "settings";

const LOADING_COPY: Partial<Record<Screen, string>> = {
  loading: "正在安排这一轮单词…",
  submitting: "正在提交…",
  continuing: "正在准备下一题…",
};

export function RangerTrialPlayClient() {
  const [screen, setScreen] = useState<Screen>("start");
  const [returnScreen, setReturnScreen] = useState<Screen>("start");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<RangerTrialPublicSession | null>(null);
  const [task, setTask] = useState<PublicLearningTask | null>(null);
  const [feedback, setFeedback] = useState<GameSubmissionFeedback | null>(null);
  const [stats, setStats] = useState<RangerTrialSessionStats>({
    attempted: 0,
    correct: 0,
    incorrect: 0,
  });
  const settings = useSyncExternalStore(
    subscribeRangerTrialSettings,
    getRangerTrialSettingsSnapshot,
    () => DEFAULT_RANGER_TRIAL_UI_SETTINGS,
  );
  const startedAt = useRef<number>(0);
  const requestId = useRef(0);
  const [errorSource, setErrorSource] = useState<"start" | "play">("start");

  useEffect(() => {
    const sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      return;
    }
    let cancelled = false;
    void resumeRangerTrialSession(sessionId).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        sessionStorage.removeItem(SESSION_KEY);
        setScreen("start");
        return;
      }
      setSession(result.progress);
      setStats(result.stats);
      if (result.completed) {
        setScreen("complete");
        return;
      }
      if (result.feedback) {
        setFeedback(result.feedback);
        setScreen("feedback");
        return;
      }
      if (result.task) {
        setTask(result.task);
        startedAt.current = performance.now();
        setScreen("playing");
        return;
      }
      setScreen("start");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    startedAt.current = performance.now();
  }, [task?.id]);

  function backToStart(): void {
    requestId.current += 1;
    sessionStorage.removeItem(SESSION_KEY);
    setError(null);
    setScreen("start");
  }

  function openSettings(): void {
    setReturnScreen(screen);
    setScreen("settings");
  }

  function updateSettings(next: RangerTrialUiSettings): void {
    saveRangerTrialSettings(next);
  }

  async function start(): Promise<void> {
    const id = requestId.current + 1;
    requestId.current = id;
    setErrorSource("start");
    setError(null);
    setScreen("loading");
    const outcome = await withClientGameTimeout(startRangerTrialSession());
    if (id !== requestId.current) {
      return;
    }
    if (outcome.timedOut) {
      setError(GAME_SESSION_USER_MESSAGES.NETWORK_ERROR);
      setScreen("error");
      return;
    }
    const result = outcome.value;
    if (!result.ok) {
      setError(result.message);
      setScreen("error");
      return;
    }
    sessionStorage.setItem(SESSION_KEY, result.session.sessionId);
    setSession(result.session);
    setTask(result.task);
    setFeedback(null);
    setStats({ attempted: 0, correct: 0, incorrect: 0 });
    setScreen("playing");
  }

  async function onAction(intent: StudentActionIntent): Promise<void> {
    if (!session || !task || screen !== "playing") {
      return;
    }
    const id = requestId.current + 1;
    requestId.current = id;
    setErrorSource("play");
    setScreen("submitting");
    const outcome = await withClientGameTimeout(
      submitRangerTrialAction({
        sessionId: session.sessionId,
        taskId: task.id,
        intent,
        responseTimeMs: Math.round(performance.now() - startedAt.current),
      }),
    );
    if (id !== requestId.current) {
      return;
    }
    if (outcome.timedOut) {
      setError(GAME_SESSION_USER_MESSAGES.NETWORK_ERROR);
      setScreen("error");
      return;
    }
    const result = outcome.value;
    if (!result.ok) {
      setError(result.message);
      setScreen("error");
      return;
    }
    setSession(result.progress);
    setStats(result.stats);
    setFeedback(result.feedback);
    setScreen("feedback");
  }

  async function onContinue(): Promise<void> {
    if (!session || screen !== "feedback") {
      return;
    }
    const id = requestId.current + 1;
    requestId.current = id;
    setErrorSource("play");
    setScreen("continuing");
    const outcome = await withClientGameTimeout(
      continueRangerTrialSession(session.sessionId),
    );
    if (id !== requestId.current) {
      return;
    }
    if (outcome.timedOut) {
      setError(GAME_SESSION_USER_MESSAGES.NETWORK_ERROR);
      setScreen("error");
      return;
    }
    const result = outcome.value;
    if (!result.ok) {
      setError(result.message);
      setScreen("error");
      return;
    }
    setSession(result.progress);
    setStats(result.stats);
    if (result.completed) {
      setTask(null);
      setFeedback(null);
      setScreen("complete");
      return;
    }
    if (!result.task) {
      setErrorSource("start");
      setError("这一轮题目没能准备好，请稍后再试。");
      setScreen("error");
      return;
    }
    setTask(result.task);
    setFeedback(null);
    setScreen("playing");
  }

  function playAgain(): void {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setTask(null);
    setFeedback(null);
    setError(null);
    setStats({ attempted: 0, correct: 0, incorrect: 0 });
    void start();
  }

  const busy = screen === "loading" || screen === "submitting" || screen === "continuing";
  const canOpenSettings =
    screen === "start" ||
    screen === "playing" ||
    screen === "feedback" ||
    screen === "complete";

  return (
    <main
      lang="zh-CN"
      data-motion={settings.motionEnabled ? "on" : "off"}
      className="ranger-trial-pilot mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <header className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">自由练习</p>
        {canOpenSettings ? (
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3 text-sm"
            onClick={openSettings}
          >
            设置
          </Button>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col justify-center">
        {screen === "start" ? (
          <div className="flex flex-col gap-8 text-center">
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">WordRanger</p>
              <h1 className="text-4xl font-semibold tracking-tight">单词闯关</h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                大约 {RANGER_TRIAL_ROUND_SIZE} 题。点选意思，或输入单词。
              </p>
            </div>
            <Button
              type="button"
              className="h-14 w-full rounded-2xl text-base"
              onClick={() => void start()}
            >
              开始闯关
            </Button>
          </div>
        ) : null}

        {busy ? (
          <p className="text-muted-foreground text-center" role="status">
            {LOADING_COPY[screen]}
          </p>
        ) : null}

        {screen === "playing" || screen === "submitting" ? (
          task && session ? (
            <RangerTrial
              task={task}
              current={session.current}
              total={session.total}
              disabled={screen === "submitting" || busy}
              onAction={(intent) => void onAction(intent)}
            />
          ) : null
        ) : null}

        {screen === "feedback" && feedback ? (
          <div className="flex flex-col gap-8">
            {session ? (
              <TaskProgress current={session.current} total={session.total} />
            ) : null}
            <TaskFeedback
              feedback={feedback}
              onContinue={() => void onContinue()}
              disabled={busy}
            />
          </div>
        ) : null}

        {screen === "complete" ? (
          <RangerTrialComplete stats={stats} onPlayAgain={playAgain} />
        ) : null}

        {screen === "error" && error ? (
          <GameSessionErrorPanel
            message={error}
            onRetry={
              errorSource === "start" ? () => void start() : undefined
            }
            onBack={backToStart}
          />
        ) : null}

        {screen === "settings" ? (
          <RangerTrialSettingsPanel
            settings={settings}
            onChange={updateSettings}
            onClose={() => setScreen(returnScreen === "settings" ? "start" : returnScreen)}
          />
        ) : null}
      </div>

      <Link
        href="/"
        className="text-muted-foreground py-2 text-center text-sm underline-offset-4 hover:underline"
      >
        返回首页
      </Link>
    </main>
  );
}
