/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextLabClient } from "@/app/play/context-lab/context-lab-client";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { createMealLabHarness } from "./helpers";

beforeEach(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

afterEach(() => {
  cleanup();
});

async function renderStarted() {
  const harness = createMealLabHarness();
  const initialScreen = await harness.controller.start();
  const view = render(
    <ContextLabClient {...harness.ops} initialScreen={initialScreen} />,
  );
  return { ...harness, initialScreen, ...view };
}

describe("Context Lab client presentation", () => {
  it("initially displays only the current server screen", async () => {
    await renderStarted();
    expect(screen.getByText("汤")).toBeTruthy();
    expect(screen.getByText("1 / 4")).toBeTruthy();
    expect(screen.queryByText("勺子 → 适合舀汤")).toBeNull();
    expect(screen.getByText("Context Lab · Experimental")).toBeTruthy();
  });

  it("继续 calls acknowledgement with runId/revision/activityId and does not increment locally first", async () => {
    const harness = createMealLabHarness();
    const initialScreen = await harness.controller.start();
    const acknowledge = vi.fn(harness.ops.acknowledge);
    let resolveAck: ((value: Awaited<ReturnType<typeof harness.ops.acknowledge>>) => void) | undefined;
    acknowledge.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAck = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <ContextLabClient
        {...harness.ops}
        acknowledge={acknowledge}
        initialScreen={initialScreen}
      />,
    );
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByText("1 / 4")).toBeTruthy();
    expect(acknowledge).toHaveBeenCalledTimes(1);
    if (initialScreen.kind !== "GUIDED") {
      throw new Error("guided");
    }
    expect(acknowledge).toHaveBeenCalledWith({
      runId: initialScreen.handle.runId,
      revision: initialScreen.handle.revision,
      activityId: initialScreen.activity.id,
    });
    resolveAck?.(
      await harness.ops.acknowledge({
        runId: initialScreen.handle.runId,
        revision: initialScreen.handle.revision,
        activityId: initialScreen.activity.id,
      }),
    );
    expect(await screen.findByText("2 / 4")).toBeTruthy();
  });

  it("server failure leaves the current screen visible", async () => {
    const harness = createMealLabHarness();
    const initialScreen = await harness.controller.start();
    const user = userEvent.setup();
    render(
      <ContextLabClient
        {...harness.ops}
        initialScreen={initialScreen}
        acknowledge={async () => {
          throw new Error("network down");
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByText("1 / 4")).toBeTruthy();
    expect(screen.getByText("汤")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/暂时没能继续|请再试/);
  });

  it("stale response shows controlled recovery", async () => {
    const harness = createMealLabHarness();
    const initialScreen = await harness.controller.start();
    const user = userEvent.setup();
    render(
      <ContextLabClient
        {...harness.ops}
        initialScreen={initialScreen}
        acknowledge={async () => ({
          kind: "ERROR",
          code: CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN,
          title: "这个体验暂时无法加载。",
          message: "这一步已经更新，请重新同步当前进度。",
          recoverable: true,
        })}
        loadCurrent={async () => {
          if (initialScreen.kind !== "GUIDED") {
            throw new Error("guided");
          }
          return {
            ...initialScreen,
            progress: { current: 2, total: 4 },
            context: {
              ...initialScreen.context,
              relationCaption: "勺子 → 适合舀汤",
            },
          };
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByText("2 / 4")).toBeTruthy();
    expect(screen.getByText("勺子 → 适合舀汤")).toBeTruthy();
  });

  it("rapid clicks send at most one mutation", async () => {
    const harness = createMealLabHarness();
    const initialScreen = await harness.controller.start();
    const acknowledge = vi.fn(harness.ops.acknowledge);
    render(
      <ContextLabClient
        {...harness.ops}
        acknowledge={acknowledge}
        initialScreen={initialScreen}
      />,
    );
    const next = screen.getByRole("button", { name: "继续" });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });

  it("restart replaces the run handle and clears preview text", async () => {
    const harness = createMealLabHarness();
    const first = await harness.controller.start();
    if (first.kind !== "GUIDED") {
      throw new Error("guided");
    }
    const restart = vi.fn(async () => {
      const next = await harness.ops.restart();
      if (next.kind !== "GUIDED") {
        throw new Error("restart must start guided");
      }
      expect(next.handle.runId).not.toBe(first.handle.runId);
      return next;
    });
    const user = userEvent.setup();
    render(
      <ContextLabClient
        {...harness.ops}
        restart={restart}
        initialScreen={first}
      />,
    );
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByText("2 / 4")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "重新体验" }));
    expect(await screen.findByText("1 / 4")).toBeTruthy();
    expect(restart).toHaveBeenCalledTimes(1);
    expect(screen.getByText("桌上有汤、碗、勺子和叉子。先看看这些物品。")).toBeTruthy();
  });

  it("preview input remains presentation-only and is never sent", async () => {
    const harness = createMealLabHarness();
    let screenState = await harness.controller.start();
    if (screenState.kind !== "GUIDED") {
      throw new Error("guided");
    }
    screenState = await harness.controller.acknowledge({
      runId: screenState.handle.runId,
      revision: screenState.handle.revision,
      activityId: screenState.activity.id,
    });
    if (screenState.kind !== "GUIDED") {
      throw new Error("guided");
    }
    screenState = await harness.controller.acknowledge({
      runId: screenState.handle.runId,
      revision: screenState.handle.revision,
      activityId: screenState.activity.id,
    });
    if (screenState.kind !== "GUIDED") {
      throw new Error("guided");
    }
    const preview = await harness.controller.acknowledge({
      runId: screenState.handle.runId,
      revision: screenState.handle.revision,
      activityId: screenState.activity.id,
    });
    const acknowledge = vi.fn(harness.ops.acknowledge);
    const restart = vi.fn(harness.ops.restart);
    const user = userEvent.setup();
    render(
      <ContextLabClient
        {...harness.ops}
        acknowledge={acknowledge}
        restart={restart}
        initialScreen={preview}
      />,
    );
    const input = screen.getByLabelText("英文答案预览");
    await user.type(input, "spoon");
    expect((input as HTMLInputElement).value).toBe("spoon");
    expect(acknowledge).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "提交功能将在下一阶段接入" }));
    expect(acknowledge).not.toHaveBeenCalled();
    expect(restart).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]'),
    ).toBeTruthy();
  });

  it("step 2 highlights only grounded entities", async () => {
    const user = userEvent.setup();
    await renderStarted();
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByText("勺子 → 适合舀汤")).toBeTruthy();
    const highlighted = screen
      .getAllByRole("article")
      .filter((node) => node.getAttribute("data-highlighted") === "true");
    expect(highlighted.map((node) => node.getAttribute("data-entity-id"))).toEqual([
      "home-soup",
      "home-spoon",
    ]);
  });

  it("does not render an error screen as a successful meal", () => {
    render(
      <ContextLabClient
        start={async () => ({
          kind: "ERROR",
          title: "这个体验暂时无法加载。",
          message: "请稍后再试，或检查本地实验开关。",
          code: CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE,
          recoverable: false,
        })}
        acknowledge={async () => {
          throw new Error("unused");
        }}
        restart={async () => {
          throw new Error("unused");
        }}
        initialScreen={{
          kind: "ERROR",
          title: "这个体验暂时无法加载。",
          message: "请稍后再试，或检查本地实验开关。",
          code: CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE,
          recoverable: false,
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "这个体验暂时无法加载。" }),
    ).toBeTruthy();
    expect(within(document.body).queryByText("汤")).toBeNull();
  });
});
