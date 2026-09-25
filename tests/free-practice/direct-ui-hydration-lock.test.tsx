/** @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FreePracticeClient } from "@/app/practice/free-practice-client";
import {
  continueFreePractice,
  loadFreePracticeSession,
  startFreePractice,
  submitFreePracticeIntent,
} from "@/app/practice/actions";
import { FREE_PRACTICE_SESSION_STORAGE_KEY } from "@/components/free-practice/free-practice-session-storage";
import { createFreePracticeOperationLock } from "@/components/free-practice/free-practice-operation-lock";
import { CLIENT_GAME_TIMEOUT_MS } from "@/components/game/shared/bounded-game-operation";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import {
  LearningTaskType,
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import type {
  FreePracticePublicSession,
  FreePracticeSessionPublicResult,
} from "@/server/free-practice/public-dto";

vi.mock("@/app/practice/actions", () => ({
  startFreePractice: vi.fn(),
  loadFreePracticeSession: vi.fn(),
  submitFreePracticeIntent: vi.fn(),
  continueFreePractice: vi.fn(),
}));

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function publicTask(id: string, text: string): PublicLearningTask {
  return {
    id,
    protocolVersion: TASK_PROTOCOL_VERSION,
    generatorVersion: TASK_GENERATOR_VERSION,
    learningNeedId: `need-${id}`,
    lexemeId: `lex-${id}`,
    targetSkill: VocabularySkill.MEANING_RECOGNITION,
    taskType: LearningTaskType.MEANING_CHOICE,
    promptMode: PromptMode.WORD_TO_MEANING,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    difficulty: 0.45,
    prompt: { kind: "LEXEME_TEXT", text },
    responseContract: {
      kind: "CHOICE",
      options: [
        { id: `${id}-1`, content: { kind: "TEXT", text: "first" } },
        { id: `${id}-2`, content: { kind: "TEXT", text: "second" } },
        { id: `${id}-3`, content: { kind: "TEXT", text: "third" } },
        { id: `${id}-4`, content: { kind: "TEXT", text: "fourth" } },
      ],
    },
    hints: [],
    createdAt: "2026-09-25T03:00:00.000Z",
  };
}

function session(
  sessionId: string,
  taskId: string,
  extras?: Partial<FreePracticePublicSession>,
): FreePracticePublicSession {
  return {
    sessionId,
    revision: 1,
    source: "UNSEEN",
    requestedCount: 5,
    plannedCount: 5,
    current: 1,
    currentTaskId: taskId,
    phase: "AWAITING_ACTION",
    attempted: 0,
    correct: 0,
    presentationGameType: "RANGER_TRIAL",
    ...extras,
  };
}

function resumed(
  sessionId: string,
  taskText: string,
): FreePracticeSessionPublicResult {
  const task = publicTask(`${sessionId}-task`, taskText);
  return {
    status: "RESUMED",
    session: session(sessionId, task.id),
    task,
  };
}

function started(
  sessionId: string,
  taskText: string,
): FreePracticeSessionPublicResult {
  const task = publicTask(`${sessionId}-task`, taskText);
  return {
    status: "STARTED",
    session: session(sessionId, task.id),
    task,
  };
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.useRealTimers();
});

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(startFreePractice).mockReset();
  vi.mocked(loadFreePracticeSession).mockReset();
  vi.mocked(submitFreePracticeIntent).mockReset();
  vi.mocked(continueFreePractice).mockReset();
  vi.mocked(loadFreePracticeSession).mockResolvedValue({ status: "NOT_FOUND" });
});

describe("Free Practice operation lock ownership", () => {
  it("C. a stale release cannot clear a newer operation lock", () => {
    const lock = createFreePracticeOperationLock();
    const first = lock.acquire();
    expect(first).toBe(1);
    expect(lock.acquire()).toBeNull();
    expect(lock.isHeld()).toBe(true);

    lock.release(first!);
    const second = lock.acquire();
    expect(second).toBe(2);
    expect(lock.isHeld()).toBe(true);

    lock.release(first!);
    expect(lock.owner()).toBe(2);
    expect(lock.isHeld()).toBe(true);

    lock.release(second!);
    expect(lock.isHeld()).toBe(false);
    expect(lock.owner()).toBeNull();
    expect(lock.acquire()).toBe(3);
  });
});

describe("Free Practice hydration and start lock", () => {
  it("A. stored session + delayed resume hides start and restores the old session", async () => {
    sessionStorage.setItem(FREE_PRACTICE_SESSION_STORAGE_KEY, "sess-stored");
    const load = deferred<FreePracticeSessionPublicResult>();
    vi.mocked(loadFreePracticeSession).mockReturnValue(load.promise);

    render(<FreePracticeClient />);

    expect(screen.queryByRole("button", { name: "开始练习" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("正在准备");
    expect(startFreePractice).not.toHaveBeenCalled();

    await act(async () => {
      load.resolve(resumed("sess-stored", "stored-word"));
    });

    await waitFor(() => {
      expect(screen.getByText("stored-word")).toBeTruthy();
    });
    expect(screen.getByText("1 / 5")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "开始练习" })).toBeNull();
    expect(startFreePractice).not.toHaveBeenCalled();
    expect(loadFreePracticeSession).toHaveBeenCalledWith({
      sessionId: "sess-stored",
    });
  });

  it("B. no stored session reveals select and start runs once", async () => {
    vi.mocked(startFreePractice).mockResolvedValue(started("sess-new", "new-word"));

    render(<FreePracticeClient />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "开始练习" })).toBeTruthy();
    });
    expect(loadFreePracticeSession).not.toHaveBeenCalled();

    const startButton = screen.getByRole("button", { name: "开始练习" });
    fireEvent.click(startButton);
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText("new-word")).toBeTruthy();
    });
    expect(startFreePractice).toHaveBeenCalledTimes(1);
    expect(startFreePractice).toHaveBeenCalledWith({
      source: "UNSEEN",
      requestedCount: 10,
    });
  });

  it("C. stale start completion does not unlock or overwrite the newer start", async () => {
    const first = deferred<FreePracticeSessionPublicResult>();
    const second = deferred<FreePracticeSessionPublicResult>();
    vi.mocked(startFreePractice)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(<FreePracticeClient />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "开始练习" })).toBeTruthy();
    });

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "开始练习" }));
    expect(screen.getByRole("status").textContent).toContain("正在准备");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CLIENT_GAME_TIMEOUT_MS);
    });
    expect(screen.getByRole("alert").textContent).toContain("暂时无法加载");

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.getByRole("status").textContent).toContain("正在准备");
    expect(startFreePractice).toHaveBeenCalledTimes(2);

    await act(async () => {
      first.resolve(started("sess-stale", "stale-word"));
    });
    expect(screen.queryByText("stale-word")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("正在准备");
    expect(screen.queryByRole("button", { name: "开始练习" })).toBeNull();

    await act(async () => {
      second.resolve(started("sess-fresh", "fresh-word"));
    });
    expect(screen.getByText("fresh-word")).toBeTruthy();
    expect(screen.queryByText("stale-word")).toBeNull();
    expect(startFreePractice).toHaveBeenCalledTimes(2);
  });

  it("D. resume NOT_FOUND clears storage, returns to select, and can start", async () => {
    sessionStorage.setItem(FREE_PRACTICE_SESSION_STORAGE_KEY, "sess-missing");
    vi.mocked(loadFreePracticeSession).mockResolvedValue({ status: "NOT_FOUND" });
    vi.mocked(startFreePractice).mockResolvedValue(started("sess-after", "after-word"));

    render(<FreePracticeClient />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "开始练习" })).toBeTruthy();
    });
    expect(sessionStorage.getItem(FREE_PRACTICE_SESSION_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole("heading", { name: "自由练习" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "开始练习" }));
    await waitFor(() => {
      expect(screen.getByText("after-word")).toBeTruthy();
    });
    expect(startFreePractice).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(FREE_PRACTICE_SESSION_STORAGE_KEY)).toBe(
      "sess-after",
    );
  });
});
