/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { MatchingPlayClient } from "@/app/play/matching/matching-play-client";
import { CLIENT_GAME_TIMEOUT_MS } from "@/components/game/shared/bounded-game-operation";
import { GAME_SESSION_USER_MESSAGES } from "@/server/game-session/ranger-trial-errors";
import {
  continueMatchingSession,
  resumeMatchingSession,
  startMatchingSession,
  submitMatchingAction,
} from "@/app/play/matching/actions";

vi.mock("@/app/play/matching/actions", () => ({
  startMatchingSession: vi.fn(),
  resumeMatchingSession: vi.fn(),
  submitMatchingAction: vi.fn(),
  continueMatchingSession: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  sessionStorage.clear();
});

beforeEach(() => {
  vi.mocked(resumeMatchingSession).mockResolvedValue({
    ok: false,
    code: "SESSION_NOT_FOUND",
    message: "not found",
  });
  vi.mocked(startMatchingSession).mockReset();
  vi.mocked(submitMatchingAction).mockReset();
  vi.mocked(continueMatchingSession).mockReset();
});

describe("Matching start loading bound", () => {
  it("R4/R5: hanging start leaves loading and shows retry", async () => {
    vi.mocked(startMatchingSession).mockReturnValue(new Promise(() => undefined));
    vi.useFakeTimers();
    render(<MatchingPlayClient />);
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    expect(screen.getByRole("status").textContent).toContain(
      "正在安排这一轮单词…",
    );
    await vi.advanceTimersByTimeAsync(CLIENT_GAME_TIMEOUT_MS);
    expect(screen.queryByText("正在安排这一轮单词…")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(
      GAME_SESSION_USER_MESSAGES.NETWORK_ERROR,
    );
    expect(screen.getByRole("button", { name: "再试一次" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "返回" })).toBeTruthy();
    expect(sessionStorage.getItem("wordranger.matching.sessionId")).toBeNull();
  });
});
