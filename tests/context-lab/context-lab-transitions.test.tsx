/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextLabClient } from "@/app/play/context-lab/context-lab-client";
import { createMealLabHarness } from "./helpers";

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

async function renderFirstScreen(reduce = false) {
  mockMotion(reduce);
  const harness = createMealLabHarness();
  const initialScreen = await harness.controller.start();
  const view = render(
    <ContextLabClient {...harness.ops} initialScreen={initialScreen} />,
  );
  return { ...harness, initialScreen, ...view };
}

describe("Context Lab transition races", () => {
  beforeEach(() => {
    mockMotion(false);
    vi.useFakeTimers();
  });

  it("repeated 继续 clicks do not skip a screen", async () => {
    const { initialScreen } = await renderFirstScreen(false);
    const next = screen.getByRole("button", { name: "继续" });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText("1 / 4")).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText("3 / 4")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(screen.getByText("勺子 → 适合舀汤")).toBeTruthy();
    if (initialScreen.kind === "GUIDED") {
      expect(initialScreen.progress.current).toBe(1);
    }
  });

  it("disables navigation controls while acknowledging", async () => {
    const harness = createMealLabHarness();
    const initialScreen = await harness.controller.start();
    let release: (() => void) | undefined;
    render(
      <ContextLabClient
        {...harness.ops}
        initialScreen={initialScreen}
        acknowledge={() =>
          new Promise((resolve) => {
            release = () => {
              void harness.ops.acknowledge({
                runId: initialScreen.kind === "GUIDED" ? initialScreen.handle.runId : "",
                revision: initialScreen.kind === "GUIDED" ? initialScreen.handle.revision : 0,
                activityId: initialScreen.kind === "GUIDED" ? initialScreen.activity.id : "",
              }).then(resolve);
            };
          })
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    await act(async () => {
      await Promise.resolve();
    });
    const next = screen.getByRole("button", { name: "继续" });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(
      document.querySelector('[data-presentation-state="TRANSITIONING"]'),
    ).toBeTruthy();
    release?.();
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(160);
    });
  });
});

describe("Context Lab reduced-motion and restart", () => {
  it("reduced motion advances immediately without a timer", async () => {
    await renderFirstScreen(true);
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByText("2 / 4")).toBeTruthy();
    expect(
      document.querySelector('[data-presentation-state="TRANSITIONING"]'),
    ).toBeNull();
  });

  it("restart clears preview text and works from the boundary", async () => {
    const harness = createMealLabHarness();
    let current = await harness.controller.start();
    for (let index = 0; index < 3; index += 1) {
      if (current.kind !== "GUIDED") {
        throw new Error("guided");
      }
      current = await harness.controller.acknowledge({
        runId: current.handle.runId,
        revision: current.handle.revision,
        activityId: current.activity.id,
      });
    }
    mockMotion(true);
    render(
      <ContextLabClient {...harness.ops} initialScreen={current} />,
    );
    const input = screen.getByLabelText("英文答案") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "spoon" } });
    expect(input.value).toBe("spoon");
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    expect(await screen.findByText("这次练习已记录。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新体验" }));
    expect(await screen.findByText("1 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByText("2 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByText("3 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(
      (await screen.findByLabelText("英文答案") as HTMLInputElement).value,
    ).toBe("");
  });

  it("progress stays within 1 / 4 through 4 / 4", async () => {
    await renderFirstScreen(true);
    expect(screen.getByLabelText("进度 1 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByLabelText("进度 2 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByLabelText("进度 3 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByLabelText("进度 4 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    expect(screen.getByLabelText("进度 4 / 4")).toBeTruthy();
    expect(screen.queryByText("5 / 4")).toBeNull();
  });
});
