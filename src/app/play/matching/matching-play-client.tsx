"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MatchingGame } from "@/components/game/matching/MatchingGame";
import { MatchingComplete } from "@/components/game/matching/MatchingComplete";
import { MatchingFeedback } from "@/components/game/matching/MatchingFeedback";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { StudentActionIntent } from "@/components/game/matching/types";
import type {
  GamePublicSession,
  GameSessionStats,
  GameSubmissionFeedback,
} from "@/server/game-session/learning-game-session.types";
import {
  continueMatchingSession,
  resumeMatchingSession,
  startMatchingSession,
  submitMatchingAction,
} from "./actions";

const SESSION_KEY = "wordranger.matching.sessionId";

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
  loading: "正在安排这一轮单词…",
  submitting: "正在提交…",
  continuing: "正在准备下一题…",
};

export function MatchingPlayClient() {
  const [screen, setScreen] = useState<Screen>("start");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<GamePublicSession | null>(null);
  const [task, setTask] = useState<PublicLearningTask | null>(null);
  const [feedback, setFeedback] = useState<GameSubmissionFeedback | null>(null);
  const [stats, setStats] = useState<GameSessionStats>({
    attempted: 0,
    correct: 0,
    incorrect: 0,
  });
  const startedAt = useRef<number>(0);

  useEffect(() => {
    const sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      return;
    }
    let cancelled = false;
    void resumeMatchingSession(sessionId).then((result) => {
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
    if (screen === "playing") {
      startedAt.current = performance.now();
    }
  }, [screen, task?.id]);

  async function start(): Promise<void> {
    setError(null);
    setScreen("loading");
    const result = await startMatchingSession();
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
    setScreen("submitting");
    const result = await submitMatchingAction({
      sessionId: session.sessionId,
      taskId: task.id,
      intent,
      responseTimeMs: Math.round(performance.now() - startedAt.current),
    });
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
    setScreen("continuing");
    const result = await continueMatchingSession(session.sessionId);
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

  const busy =
    screen === "loading" || screen === "submitting" || screen === "continuing";
  const feedbackResult =
    feedback?.status === "CORRECT" || feedback?.status === "ASSISTED"
      ? "correct"
      : feedback?.status === "INCORRECT"
        ? "incorrect"
        : undefined;

  return (
    <main
      lang="zh-CN"
      className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-8 px-5 py-10"
    >
      {screen === "start" ? (
        <div className="flex flex-col gap-8 text-center">
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">WordRanger</p>
            <h1 className="text-4xl font-semibold tracking-tight">连连看</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              先点左边，再找到右边最合适的一项。
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

      {screen === "playing" || screen === "submitting" || screen === "feedback" ? (
        task && session ? (
          <MatchingGame
            task={task}
            current={session.current}
            total={session.total}
            disabled={screen !== "playing" || busy}
            result={screen === "feedback" ? feedbackResult : undefined}
            onAction={(intent) => void onAction(intent)}
          />
        ) : null
      ) : null}

      {screen === "feedback" && feedback ? (
        <MatchingFeedback
          feedback={feedback}
          onContinue={() => void onContinue()}
          disabled={busy}
        />
      ) : null}

      {screen === "complete" ? (
        <MatchingComplete stats={stats} onPlayAgain={playAgain} />
      ) : null}

      {screen === "error" ? (
        <div className="flex flex-col gap-6 text-center">
          <p className="text-base" role="alert">
            {error}
          </p>
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={() => {
              sessionStorage.removeItem(SESSION_KEY);
              setError(null);
              setScreen("start");
            }}
          >
            返回
          </Button>
        </div>
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
