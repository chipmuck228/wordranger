"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GameSessionErrorPanel } from "@/components/game/shared/GameSessionErrorPanel";
import { InlineTrainingFeedback } from "@/components/training/inline-training-feedback";
import {
  withClientGameTimeout,
  type ClientGameTimeoutResult,
} from "@/components/game/shared/bounded-game-operation";
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

async function boundedTrainingAction<T>(
  operation: Promise<T>,
): Promise<ClientGameTimeoutResult<T>> {
  try {
    return await withClientGameTimeout(operation);
  } catch {
    return { timedOut: true };
  }
}

const LOADING_COPY: Partial<Record<Screen, string>> = {
  loading: "正在准备练习…",
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
  const advancing = useRef(false);
  const skipMountHydrate = useRef(false);
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
      if (result.task) {
        setTask(result.task);
      }
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
    const outcome = await boundedTrainingAction(resumeDailyTrainingSession(sessionId));
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
    if (skipMountHydrate.current) {
      return;
    }
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
    skipMountHydrate.current = true;
    const id = requestId.current + 1;
    requestId.current = id;
    setErrorSource("start");
    setError(null);
    setScreen("loading");
    const outcome = await boundedTrainingAction(startDailyTrainingSession());
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
    advancing.current = false;
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
    const outcome = await boundedTrainingAction(
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
    if (!session || screen !== "feedback" || advancing.current) {
      return;
    }
    advancing.current = true;
    const id = requestId.current + 1;
    requestId.current = id;
    setErrorSource("play");
    setScreen("continuing");
    const outcome = await boundedTrainingAction(
      continueDailyTrainingSession(session.sessionId),
    );
    if (id !== requestId.current) {
      return;
    }
    advancing.current = false;
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
    advancing.current = false;
    void start();
  }

  const busy = screen === "loading" || screen === "submitting" || screen === "continuing";
  const showTask =
    Boolean(task && session && rendererGameType) &&
    (screen === "playing" ||
      screen === "submitting" ||
      screen === "feedback" ||
      screen === "continuing");
  const feedbackResult =
    feedback?.status === "CORRECT" || feedback?.status === "ASSISTED"
      ? "correct"
      : feedback
        ? "incorrect"
        : undefined;

  return (
    <main
      lang="zh-CN"
      className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-8 px-5 py-10 sm:max-w-2xl sm:px-8 md:max-w-3xl md:justify-start md:py-12 lg:max-w-5xl lg:px-16 lg:py-20"
    >
      {screen === "start" ? (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8 text-center md:mx-0 md:max-w-2xl md:text-left">
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">WordRanger</p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
              自由练习
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed md:max-w-xl md:text-lg">
              单词由系统根据当前学习情况安排。
            </p>
          </div>
          <Button
            type="button"
            className="h-12 w-full text-base sm:mx-auto sm:w-auto sm:min-w-52 sm:self-center md:mx-0 md:h-14 md:min-w-56 md:self-start md:text-lg"
            onClick={() => void start()}
          >
            开始练习
          </Button>
        </div>
      ) : null}

      {busy && !showTask ? (
        <p className="text-muted-foreground text-center" role="status">
          {LOADING_COPY[screen]}
        </p>
      ) : null}

      {showTask && task && session && rendererGameType ? (
        <div className="flex flex-col gap-5 md:gap-6 md:rounded-3xl md:border md:border-border md:bg-card md:px-8 md:py-8 lg:gap-8 lg:px-12 lg:py-10">
          <p className="text-muted-foreground text-center text-sm md:text-left" aria-live="polite">
            {session.current} / {session.total}
          </p>
          <TrainingRenderer
            key={task.id}
            rendererGameType={rendererGameType}
            task={task}
            current={session.current}
            total={session.total}
            disabled={screen !== "playing"}
            selectedOptionId={selectedOptionId}
            result={
              screen === "submitting" || screen === "feedback"
                ? feedbackResult
                : undefined
            }
            logicalTickMs={logicalTickMs}
            onAction={(intent) => void onAction(intent)}
          />
          {feedback && (screen === "feedback" || screen === "continuing") ? (
            <InlineTrainingFeedback
              feedback={feedback}
              onContinue={() => void onContinue()}
              disabled={busy}
            />
          ) : null}
          {screen === "submitting" ? (
            <p className="text-muted-foreground text-sm" role="status">
              {LOADING_COPY.submitting}
            </p>
          ) : null}
        </div>
      ) : null}

      {screen === "feedback" && feedback && !showTask ? (
        <InlineTrainingFeedback
          feedback={feedback}
          onContinue={() => void onContinue()}
          disabled={busy}
        />
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
        className="text-muted-foreground text-center text-sm underline-offset-4 hover:underline md:self-start"
      >
        返回首页
      </Link>
    </main>
  );
}
