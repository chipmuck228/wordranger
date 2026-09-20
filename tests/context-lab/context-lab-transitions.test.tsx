/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextLabClient } from "@/app/play/context-lab/context-lab-client";
import { prepareMealContextLab } from "@/server/context-lab/prepare-meal-context-lab";

function mockMotion(reduce: boolean): void {
  window.matchMedia = (query: string) =>
    ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Context Lab transition races", () => {
  beforeEach(() => {
    mockMotion(false);
    vi.useFakeTimers();
  });

  it("repeated 继续 clicks do not skip a screen", () => {
    render(<ContextLabClient payload={prepareMealContextLab()} />);
    const next = screen.getByRole("button", { name: "继续" });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText("1 / 4")).toBeTruthy();
    expect(screen.queryByText("勺子 → 适合舀汤")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(screen.getByText("勺子 → 适合舀汤")).toBeTruthy();
    expect(screen.queryByText("3 / 4")).toBeNull();
  });

  it("disables navigation controls while transitioning", () => {
    render(<ContextLabClient payload={prepareMealContextLab()} />);
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    const next = screen.getByRole("button", { name: "继续" });
    expect(
      next.getAttribute("aria-disabled") === "true" ||
        (next as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      document.querySelector('[data-presentation-state="TRANSITIONING"]'),
    ).toBeTruthy();
    expect((screen.getByRole("button", { name: "重新体验" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("restart cancels a pending transition", () => {
    render(<ContextLabClient payload={prepareMealContextLab()} />);
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    fireEvent.click(screen.getByRole("button", { name: "重新体验" }));
    expect(screen.getByText("1 / 4")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText("1 / 4")).toBeTruthy();
    expect(screen.getByText("桌上有汤、碗、勺子和叉子。先看看这些物品。")).toBeTruthy();
  });

  it("unmount cancels pending timers", () => {
    const { unmount } = render(
      <ContextLabClient payload={prepareMealContextLab()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    unmount();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }).not.toThrow();
  });
});

describe("Context Lab reduced-motion and restart", () => {
  it("reduced motion advances immediately without a timer", async () => {
    mockMotion(true);
    vi.useFakeTimers();
    render(<ContextLabClient payload={prepareMealContextLab()} />);
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(
      document.querySelector('[data-presentation-state="TRANSITIONING"]'),
    ).toBeNull();
  });

  it("restart clears preview text and works from the boundary", async () => {
    mockMotion(true);
    render(<ContextLabClient payload={prepareMealContextLab()} />);
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    const input = screen.getByLabelText("英文答案预览") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "spoon" } });
    expect(input.value).toBe("spoon");
    fireEvent.click(screen.getByRole("button", { name: "提交功能将在下一阶段接入" }));
    expect(
      document.querySelector('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新体验" }));
    expect(screen.getByText("1 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect((screen.getByLabelText("英文答案预览") as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("progress stays within 1 / 4 through 4 / 4", () => {
    mockMotion(true);
    render(<ContextLabClient payload={prepareMealContextLab()} />);
    expect(screen.getByLabelText("进度 1 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByLabelText("进度 2 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByLabelText("进度 3 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByLabelText("进度 4 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "提交功能将在下一阶段接入" }));
    expect(screen.getByLabelText("进度 4 / 4")).toBeTruthy();
    expect(screen.queryByText("5 / 4")).toBeNull();
    expect(screen.queryByText("0 / 4")).toBeNull();
  });
});
