/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HomeDailyStatus } from "@/components/training/home-daily-status";
import { DAILY_TRAINING_COMPLETED_ROUNDS_KEY } from "@/components/training/training-session-storage";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("HomeDailyStatus presentation", () => {
  it("keeps completed-round storage semantics", () => {
    render(<HomeDailyStatus />);
    expect(screen.getByText("今天还没有完成练习")).toBeTruthy();
    sessionStorage.setItem(DAILY_TRAINING_COMPLETED_ROUNDS_KEY, "2");
    cleanup();
    render(<HomeDailyStatus />);
    expect(screen.getByText("今天已完成 2 组练习")).toBeTruthy();
    expect(sessionStorage.getItem(DAILY_TRAINING_COMPLETED_ROUNDS_KEY)).toBe("2");
  });
});
