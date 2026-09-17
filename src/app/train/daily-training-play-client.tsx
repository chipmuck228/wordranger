"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TaskFeedback } from "@/components/game/ranger-trial/TaskFeedback";
import { GameSessionErrorPanel } from "@/components/game/shared/GameSessionErrorPanel";
import { withClientGameTimeout } from "@/components/game/shared/bounded-game-operation";
import { SNAKE_LOGICAL_TICK_MS } from "@/components/game/snake/snake-engine";
import { TrainingComplete } from "@/components/training/TrainingComplete";
import { TrainingRenderer } from "@/components/training/TrainingRenderer";
import {
  DAILY_TRAINING_SESSION_KEY,
  markDailyTrainingRoundComplete,
} from "@/components/training/training-session-storage";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import { DAILY_TRAINING_USER_MESSAGES } from "@/server/training/daily-training-errors";
import type {
  DailyTrainingPublicSession,
  StudentActionIntent,
} from "@/server/training/daily-training.types";
import type {
  GameSessionStats,
  GameSubmissionFeedback,
} from "@/server/game-session/learning-game-session.types";
import {
  continueDailyTrainingSession,
  resumeDailyTrainingSession,
  startDailyTrainingSession,
  submitDailyTrainingAction,
} from "./actions";

type Screen =
  | "start"
  | "loading"
  | "playing"
  | "submitting"
  | "feedback"
  | "continuing"
  | "complete"
  | "error";

const LOADING_COPY: Partial<Record<Screen, string>> = {
  loading: "正在准备今天的训练…",
  submitting: "正在提交…",
  continuing: "下一题",
};

function tickMsFromSearch(): number {
  const raw = new URLSearchParams(window.location.search).get("tickMs");
  const parsed = raw ? Number(raw) : SNAKE_LOGICAL_TICK_MS;
  if (!Number.isFinite(parsed)) {
    return SNAKE_LOGICAL_TICK_MS;
  }
  return Math.min(400, Math.max(40, parsed));
}

function subscribeTickMs(onStoreChange: () => void): () => void {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

export function DailyTrainingPlayClient() {
  const [screen, setScreen] = useState<Screen>("start");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<DailyTrainingPublicSession | null>(null);
  const [task, setTask] = useState<PublicLearningTask | null>(null);
  const [rendererGameType, setRendererGameType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<GameSubmissionFeedback | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [recapWords, setRecapWords] = useState<string[]>([]);
  const [stats, setStats] = useState<GameSessionStats>({
    attempted: 0,
    correct: 0,
    incorrect: 0,
  });
  const startedAt = useRef<number>(0);
  const requestId = useRef(0);
  const [errorSource, setErrorSource] = useState<"start" | "play">("start");
  const logicalTickMs = useSyncExternalStore(
    subscribeTickMs,
    tickMsFromSearch,
    () => SNAKE_LOGICAL_TICK_MS,
  );

  function applyResume(result: {
    completed: boolean;
    progress: DailyTrainingPublicSession;
    stats: GameSessionStats;
    task?: PublicLearningTask;
    rendererGameType?: string;
    feedback?: GameSubmissionFeedback;
    recapWords?: string[];
  }): void {
    setSession(result.progress);
    setStats(result.stats);
    if (result.completed) {
      setRecapWords(result.recapWords ?? []);
      markDailyTrainingRoundComplete(result.progress.sessionId);
      setScreen("complete");
      return;
    }
    if (result.feedback) {
      setFeedback(result.feedback);
      setRendererGameType(result.rendererGameType ?? result.progress.rendererGameType);
      setScreen("feedback");
      return;
    }
    if (result.task) {
      setTask(result.task);
      setRendererGameType(result.rendererGameType ?? result.progress.rendererGameType);
      startedAt.current = performance.now();
      setScreen("playing");
      return;
    }
    setScreen("start");
  }

  async function hydrateExistingSession(sessionId: string, id: number): Promise<void> {
    setErrorSource("play");
    setError(null);
    setScreen("loading");
    const outcome = await withClientGameTimeout(resumeDailyTrainingSession(sessionId));
    if (id !== requestId.current) {
      return;
    }
    if (outcome.timedOut) {
      setError(DAILY_TRAINING_USER_MESSAGES.NETWORK_ERROR);
      setScreen("error");
      return;
    }
    const result = outcome.value;
    if (!result.ok) {
      sessionStorage.removeItem(DAILY_TRAINING_SESSION_KEY);
      setScreen("start");
      return;
    }
    applyResume(result);
  }

  useEffect(() => {
    const sessionId = sessionStorage.getItem(DAILY_TRAINING_SESSION_KEY);
    if (!sessionId) {
      return;
    }
    const id = requestId.current + 1;
    requestId.current = id;
    void hydrateExistingSession(sessionId, id);
    // Mount-only restore of the product session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen === "playing") {
      startedAt.current = performance.now();
    }
  }, [screen, task?.id]);

  function backToStart(): void {
    requestId.current += 1;
    sessionStorage.removeItem(DAILY_TRAINING_SESSION_KEY);
    setError(null);
    setScreen("start");
  }

  async function start(): Promise<void> {
    const id = requestId.current + 1;
    requestId.current = id;
    setErrorSource("start");
    setError(null);
    setScreen("loading");
    const outcome = await withClientGameTimeout(startDailyTrainingSession());
    if (id !== requestId.current) {
      return;
    }
    if (outcome.timedOut) {
      setError(DAILY_TRAINING_USER_MESSAGES.NETWORK_ERROR);
      setScreen("error");
      return;
    }
    const result = outcome.value;
    if (!result.ok) {
      setError(result.message);
      setScreen("error");
      return;
    }
    sessionStorage.setItem(DAILY_TRAINING_SESSION_KEY, result.session.sessionId);
    setSession(result.session);
    setTask(result.task);
    setRendererGameType(result.rendererGameType);
    setFeedback(null);
    setSelectedOptionId(null);
    setRecapWords([]);
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
    if (intent.kind === "CHOICE") {
      setSelectedOptionId(intent.optionId);
    }
    setScreen("submitting");
    const outcome = await withClientGameTimeout(
      submitDailyTrainingAction({
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
      setError(DAILY_TRAINING_USER_MESSAGES.NETWORK_ERROR);
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
      continueDailyTrainingSession(session.sessionId),
    );
    if (id !== requestId.current) {
      return;
    }
    if (outcome.timedOut) {
      setError(DAILY_TRAINING_USER_MESSAGES.NETWORK_ERROR);
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
      setRendererGameType(null);
      setRecapWords(result.recapWords ?? []);
      markDailyTrainingRoundComplete(result.progress.sessionId);
      setScreen("complete");
      return;
    }
    if (!result.task || !result.rendererGameType) {
      setErrorSource("start");
      setError(DAILY_TRAINING_USER_MESSAGES.TASK_GENERATION_FAILED);
      setScreen("error");
      return;
    }
    setTask(result.task);
    setRendererGameType(result.rendererGameType);
    setFeedback(null);
    setSelectedOptionId(null);
    setScreen("playing");
  }

  function playAgain(): void {
    sessionStorage.removeItem(DAILY_TRAINING_SESSION_KEY);
    setSession(null);
    setTask(null);
    setRendererGameType(null);
    setFeedback(null);
    setSelectedOptionId(null);
    setRecapWords([]);
    setError(null);
    setStats({ attempted: 0, correct: 0, incorrect: 0 });
    void start();
  }

  const busy = screen === "loading" || screen === "submitting" || screen === "continuing";
  const feedbackResult =
    feedback?.status === "CORRECT" || feedback?.status === "ASSISTED"
      ? "correct"
      : feedback
        ? "incorrect"
        : undefined;

  return (
    <main
      lang="zh-CN"
      className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-8 px-5 py-10"
    >
      {screen === "start" ? (
        <div className="flex flex-col gap-8 text-center">
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">WordRanger</p>
            <h1 className="text-4xl font-semibold tracking-tight">今日训练</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              系统会安排今天最值得练的单词。
            </p>
          </div>
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={() => void start()}
          >
            开始
          </Button>
        </div>
      ) : null}

      {busy ? (
        <p className="text-muted-foreground text-center" role="status">
          {LOADING_COPY[screen]}
        </p>
      ) : null}

      {screen === "playing" || screen === "submitting" ? (
        task && session && rendererGameType ? (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-center text-sm" aria-live="polite">
              {session.current} / {session.total}
            </p>
            <TrainingRenderer
              key={task.id}
              rendererGameType={rendererGameType}
              task={task}
              current={session.current}
              total={session.total}
              disabled={screen === "submitting" || busy}
              selectedOptionId={selectedOptionId}
              result={screen === "submitting" ? feedbackResult : undefined}
              logicalTickMs={logicalTickMs}
              onAction={(intent) => void onAction(intent)}
            />
          </div>
        ) : null
      ) : null}

      {screen === "feedback" && feedback ? (
        <div className="flex flex-col gap-8">
          {session ? (
            <p className="text-muted-foreground text-sm">
              {session.current} / {session.total}
            </p>
          ) : null}
          <TaskFeedback
            feedback={feedback}
            onContinue={() => void onContinue()}
            disabled={busy}
          />
        </div>
      ) : null}

      {screen === "complete" ? (
        <TrainingComplete
          stats={stats}
          recapWords={recapWords}
          onPlayAgain={playAgain}
        />
      ) : null}

      {screen === "error" && error ? (
        <GameSessionErrorPanel
          message={error}
          onRetry={() => {
            const sessionId = sessionStorage.getItem(DAILY_TRAINING_SESSION_KEY);
            if (errorSource === "play" && sessionId) {
              const id = requestId.current + 1;
              requestId.current = id;
              void hydrateExistingSession(sessionId, id);
              return;
            }
            void start();
          }}
          onBack={backToStart}
        />
      ) : null}

      <Link
        href="/"
        className="text-muted-foreground text-center text-sm underline-offset-4 hover:underline"
      >
        返回首页
      </Link>
    </main>
  );
}
