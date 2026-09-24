"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DirectPracticeRenderer } from "@/components/training/DirectPracticeRenderer";
import { InlineTrainingFeedback } from "@/components/training/inline-training-feedback";
import {
  clearFreePracticeSessionId,
  readFreePracticeSessionId,
  writeFreePracticeSessionId,
} from "@/components/free-practice/free-practice-session-storage";
import {
  withClientGameTimeout,
  type ClientGameTimeoutResult,
} from "@/components/game/shared/bounded-game-operation";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type {
  FreePracticePublicFeedback,
  FreePracticePublicSession,
  FreePracticeRequestedCount,
  FreePracticeSessionPublicResult,
  FreePracticeSource,
} from "@/server/free-practice/public-dto";
import type { StudentActionIntent } from "@/server/game-session/learning-game-session.types";
import type { GameSubmissionFeedback } from "@/server/game-session/learning-game-session.types";
import {
  continueFreePractice,
  loadFreePracticeSession,
  startFreePractice,
  submitFreePracticeIntent,
} from "./actions";

type Screen =
  | "select"
  | "empty"
  | "unavailable"
  | "preparing"
  | "playing"
  | "submitting"
  | "feedback"
  | "continuing"
  | "complete"
  | "error";

const SOURCE_COPY: Record<
  FreePracticeSource,
  { label: string; description: string; empty: string }
> = {
  UNSEEN: {
    label: "练习新单词",
    description: "从还没有练习记录的单词中选择",
    empty: "现在没有可练习的新单词",
  },
  RECENTLY_INCORRECT: {
    label: "复习最近答错的单词",
    description: "重新练习最近还没有答对的内容",
    empty: "最近没有答错的单词",
  },
};

const LOADING_COPY: Partial<Record<Screen, string>> = {
  preparing: "正在准备",
  submitting: "提交中",
  continuing: "正在进入下一题",
};

async function boundedAction<T>(
  operation: Promise<T>,
): Promise<ClientGameTimeoutResult<T>> {
  try {
    return await withClientGameTimeout(operation);
  } catch {
    return { timedOut: true };
  }
}

function toInlineFeedback(
  feedback: FreePracticePublicFeedback,
): GameSubmissionFeedback {
  return {
    status: feedback.correct ? "CORRECT" : "INCORRECT",
    message: feedback.message,
    continueAvailable: true,
  };
}

export function FreePracticeClient() {
  const [screen, setScreen] = useState<Screen>("select");
  const [source, setSource] = useState<FreePracticeSource>("UNSEEN");
  const [requestedCount, setRequestedCount] =
    useState<FreePracticeRequestedCount>(10);
  const sourceRef = useRef<FreePracticeSource>("UNSEEN");
  const countRef = useRef<FreePracticeRequestedCount>(10);
  const [session, setSession] = useState<FreePracticePublicSession | null>(null);
  const [task, setTask] = useState<PublicLearningTask | null>(null);
  const [feedback, setFeedback] = useState<FreePracticePublicFeedback | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const startedAt = useRef(0);
  const requestId = useRef(0);
  const lastIntent = useRef<StudentActionIntent | null>(null);
  const retryKind = useRef<"start" | "load" | "submit" | "continue" | null>(
    null,
  );
  const inFlight = useRef(false);

  useEffect(() => {
    const stored = readFreePracticeSessionId();
    if (!stored) {
      return;
    }
    void resume(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydrate
  }, []);

  function applyResult(
    result: FreePracticeSessionPublicResult,
    options?: { fromStart?: boolean },
  ): boolean {
    if (result.status === "EMPTY") {
      clearFreePracticeSessionId();
      setSession(null);
      setTask(null);
      setFeedback(null);
      setSource(result.source);
      setRequestedCount(result.requestedCount as FreePracticeRequestedCount);
      setPartialNotice(null);
      setScreen("empty");
      return true;
    }
    if (result.status === "UNAVAILABLE") {
      setScreen("unavailable");
      return true;
    }
    if (result.status === "NOT_FOUND") {
      clearFreePracticeSessionId();
      setSession(null);
      setTask(null);
      setFeedback(null);
      setPartialNotice(null);
      setScreen("select");
      return true;
    }
    if (result.status === "CONFLICT") {
      return false;
    }
    if (result.status === "INVALID") {
      setError("这次操作没有完成，请再试一次。");
      setScreen("error");
      return true;
    }
    if (result.status === "COMPLETED") {
      writeFreePracticeSessionId(result.session.sessionId);
      setSession(result.session);
      setTask(null);
      setFeedback(null);
      setPartialNotice(null);
      setScreen("complete");
      return true;
    }
    writeFreePracticeSessionId(result.session.sessionId);
    setSession(result.session);
    setTask(result.task);
    if (options?.fromStart && result.session.plannedCount < result.session.requestedCount) {
      setPartialNotice(`这次有 ${result.session.plannedCount} 个可练习的单词`);
    }
    if (result.status === "AWAITING_CONTINUE") {
      setFeedback(result.feedback);
      setScreen("feedback");
      return true;
    }
    setFeedback(null);
    startedAt.current = performance.now();
    setScreen("playing");
    return true;
  }

  async function resume(sessionId: string): Promise<void> {
    const id = ++requestId.current;
    retryKind.current = "load";
    setScreen("preparing");
    const bounded = await boundedAction(loadFreePracticeSession({ sessionId }));
    if (id !== requestId.current) {
      return;
    }
    if (bounded.timedOut) {
      setError("暂时无法加载");
      setScreen("error");
      return;
    }
    if (bounded.value.status === "CONFLICT") {
      const retry = await boundedAction(loadFreePracticeSession({ sessionId }));
      if (id !== requestId.current) {
        return;
      }
      if (retry.timedOut || retry.value.status === "CONFLICT") {
        setError("暂时无法加载");
        setScreen("error");
        return;
      }
      applyResult(retry.value);
      return;
    }
    applyResult(bounded.value);
  }

  async function start(nextSource = source, nextCount = requestedCount): Promise<void> {
    const id = ++requestId.current;
    retryKind.current = "start";
    setSource(nextSource);
    setRequestedCount(nextCount);
    setScreen("preparing");
    setError(null);
    const bounded = await boundedAction(
      startFreePractice({ source: nextSource, requestedCount: nextCount }),
    );
    if (id !== requestId.current) {
      return;
    }
    if (bounded.timedOut) {
      setError("暂时无法加载");
      setScreen("error");
      return;
    }
    applyResult(bounded.value, { fromStart: true });
  }

  async function submit(intent: StudentActionIntent): Promise<void> {
    if (!session || !task || screen === "submitting" || inFlight.current) {
      return;
    }
    inFlight.current = true;
    const id = ++requestId.current;
    retryKind.current = "submit";
    lastIntent.current = intent;
    setScreen("submitting");
    setError(null);
    const bounded = await boundedAction(
      submitFreePracticeIntent({
        sessionId: session.sessionId,
        revision: session.revision,
        taskId: task.id,
        intent,
        responseTimeMs: Math.round(performance.now() - startedAt.current),
      }),
    );
    if (id !== requestId.current) {
      return;
    }
    if (bounded.timedOut) {
      inFlight.current = false;
      setError("暂时无法加载");
      setScreen("error");
      return;
    }
    if (bounded.value.status === "CONFLICT") {
      const recovered = await boundedAction(
        loadFreePracticeSession({ sessionId: session.sessionId }),
      );
      if (id !== requestId.current) {
        return;
      }
      if (recovered.timedOut || recovered.value.status === "CONFLICT") {
        inFlight.current = false;
        setError("暂时无法加载");
        setScreen("error");
        return;
      }
      inFlight.current = false;
      applyResult(recovered.value);
      return;
    }
    inFlight.current = false;
    applyResult(bounded.value);
  }

  async function continueSession(): Promise<void> {
    if (!session || !task || screen === "continuing" || inFlight.current) {
      return;
    }
    inFlight.current = true;
    const id = ++requestId.current;
    retryKind.current = "continue";
    setScreen("continuing");
    setError(null);
    const bounded = await boundedAction(
      continueFreePractice({
        sessionId: session.sessionId,
        revision: session.revision,
        taskId: task.id,
      }),
    );
    if (id !== requestId.current) {
      return;
    }
    if (bounded.timedOut) {
      inFlight.current = false;
      setError("暂时无法加载");
      setScreen("error");
      return;
    }
    if (bounded.value.status === "CONFLICT") {
      const recovered = await boundedAction(
        loadFreePracticeSession({ sessionId: session.sessionId }),
      );
      if (id !== requestId.current) {
        return;
      }
      if (recovered.timedOut || recovered.value.status === "CONFLICT") {
        inFlight.current = false;
        setError("暂时无法加载");
        setScreen("error");
        return;
      }
      inFlight.current = false;
      applyResult(recovered.value);
      return;
    }
    inFlight.current = false;
    applyResult(bounded.value);
  }

  function retry(): void {
    inFlight.current = false;
    if (retryKind.current === "start") {
      void start();
      return;
    }
    if (retryKind.current === "load") {
      const stored = readFreePracticeSessionId();
      if (stored) {
        void resume(stored);
        return;
      }
      setScreen("select");
      return;
    }
    if (retryKind.current === "submit" && lastIntent.current) {
      void submit(lastIntent.current);
      return;
    }
    if (retryKind.current === "continue") {
      void continueSession();
      return;
    }
    setScreen("select");
  }

  function resetSelection(): void {
    clearFreePracticeSessionId();
    setSession(null);
    setTask(null);
    setFeedback(null);
    setPartialNotice(null);
    setError(null);
    sourceRef.current = source;
    countRef.current = requestedCount;
    setScreen("select");
  }

  const busy =
    screen === "preparing" ||
    screen === "submitting" ||
    screen === "continuing";
  const showTask =
    Boolean(task && session) &&
    (screen === "playing" ||
      screen === "submitting" ||
      screen === "feedback" ||
      screen === "continuing");
  const lastItem =
    session !== null && session.current >= session.plannedCount;

  return (
    <main
      lang="zh-CN"
      className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-8 px-5 py-10 sm:max-w-2xl sm:px-8 md:max-w-3xl md:justify-start md:py-12 lg:max-w-5xl lg:px-16 lg:py-20"
    >
      {screen === "select" ? (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8 md:mx-0 md:max-w-2xl">
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">内部预览</p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              自由练习
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
              选择一组单词，按自己的节奏练习。
            </p>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">练习内容</legend>
            {(Object.keys(SOURCE_COPY) as FreePracticeSource[]).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer flex-col gap-1 rounded-2xl border border-black/10 bg-white px-4 py-3 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="source"
                    value={value}
                    checked={source === value}
                    onChange={() => {
                      sourceRef.current = value;
                      setSource(value);
                    }}
                    aria-label={SOURCE_COPY[value].label}
                  />
                  <span className="font-medium">{SOURCE_COPY[value].label}</span>
                </span>
                <span className="text-muted-foreground pl-7 text-sm">
                  {SOURCE_COPY[value].description}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">题目数量</legend>
            <div className="flex gap-3">
              {([5, 10] as const).map((count) => (
                <label
                  key={count}
                  className="flex cursor-pointer items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                >
                  <input
                    type="radio"
                    name="count"
                    value={count}
                    checked={requestedCount === count}
                    onChange={() => {
                      countRef.current = count;
                      setRequestedCount(count);
                    }}
                    aria-label={`${count} 个`}
                  />
                  <span>{count} 个</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="h-12 w-full rounded-2xl text-base sm:w-auto sm:min-w-40"
              onClick={() => void start(sourceRef.current, countRef.current)}
            >
              开始练习
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              className="h-12 w-full rounded-2xl text-base sm:w-auto"
              render={<Link href="/" />}
            >
              回到首页
            </Button>
          </div>
        </div>
      ) : null}

      {screen === "empty" ? (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 md:mx-0">
          <h1 className="text-3xl font-semibold tracking-tight">自由练习</h1>
          <p role="status">{SOURCE_COPY[source].empty}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="h-12 rounded-2xl"
              onClick={resetSelection}
            >
              重新选择
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              className="h-12 rounded-2xl"
              render={<Link href="/" />}
            >
              回到首页
            </Button>
          </div>
        </div>
      ) : null}

      {screen === "unavailable" ? (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 md:mx-0">
          <h1 className="text-3xl font-semibold tracking-tight">自由练习</h1>
          <p role="status">现在无法开始练习。</p>
          <Button
            nativeButton={false}
            variant="outline"
            className="h-12 rounded-2xl"
            render={<Link href="/" />}
          >
            回到首页
          </Button>
        </div>
      ) : null}

      {busy && !showTask ? (
        <p role="status" aria-live="polite">
          {LOADING_COPY[screen]}
        </p>
      ) : null}

      {showTask && session && task ? (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 md:mx-0 md:max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">自由练习</h1>
              <p className="text-muted-foreground text-sm">
                {SOURCE_COPY[session.source].label}
              </p>
            </div>
            <p
              aria-live="polite"
              className="text-sm font-medium"
              data-progress={`${session.current}/${session.plannedCount}`}
            >
              {session.current} / {session.plannedCount}
            </p>
          </div>
          {partialNotice ? (
            <p role="status" className="text-sm">
              {partialNotice}
            </p>
          ) : null}
          <div data-renderer="DIRECT_PRACTICE">
            <DirectPracticeRenderer
              task={task}
              disabled={screen !== "playing"}
              onAction={(intent) => void submit(intent)}
            />
          </div>
          {screen === "feedback" && feedback ? (
            <InlineTrainingFeedback
              feedback={toInlineFeedback(feedback)}
              title={feedback.message}
              hideCorrection
              continueLabel={lastItem ? "完成" : "下一题"}
              disabled={false}
              onContinue={() => void continueSession()}
            />
          ) : null}
          {busy ? (
            <p role="status" aria-live="polite">
              {LOADING_COPY[screen]}
            </p>
          ) : null}
          <Button
            nativeButton={false}
            variant="ghost"
            className="self-start"
            render={<Link href="/" />}
          >
            回到首页
          </Button>
        </div>
      ) : null}

      {screen === "complete" && session ? (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 md:mx-0">
          <h1 className="text-3xl font-semibold tracking-tight">本组练习完成</h1>
          <p role="status">完成 {session.attempted} 个</p>
          <p>答对 {session.correct} 个</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="h-12 rounded-2xl"
              onClick={() => void start(session.source, session.requestedCount as FreePracticeRequestedCount)}
            >
              再练一组
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-2xl"
              onClick={resetSelection}
            >
              重新选择
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              className="h-12 rounded-2xl"
              render={<Link href="/" />}
            >
              回到首页
            </Button>
          </div>
        </div>
      ) : null}

      {screen === "error" ? (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 md:mx-0">
          <h1 className="text-3xl font-semibold tracking-tight">自由练习</h1>
          <p role="alert">{error ?? "暂时无法加载"}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="h-12 rounded-2xl" onClick={retry}>
              重试
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              className="h-12 rounded-2xl"
              render={<Link href="/" />}
            >
              回到首页
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
