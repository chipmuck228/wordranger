/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextLabClient } from "@/app/play/context-lab/context-lab-client";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { prepareMealContextLab } from "@/server/context-lab/prepare-meal-context-lab";

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

function renderPilot() {
  const payload = prepareMealContextLab();
  const view = render(<ContextLabClient payload={payload} />);
  return { payload, ...view };
}

describe("Context Lab client presentation", () => {
  it("step 1 renders soup, bowl, spoon, and fork", () => {
    renderPilot();
    expect(screen.getByText("汤")).toBeTruthy();
    expect(screen.getByText("碗")).toBeTruthy();
    expect(screen.getByText("勺子")).toBeTruthy();
    expect(screen.getByText("叉子")).toBeTruthy();
    expect(screen.getByText("1 / 4")).toBeTruthy();
    expect(screen.getByText("Context Lab · Experimental")).toBeTruthy();
  });

  it("继续 advances Guided presentation without correctness feedback", async () => {
    const user = userEvent.setup();
    renderPilot();
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByText("勺子 → 适合舀汤")).toBeTruthy();
    expect(screen.queryByText(/答对了|掌握了|完成学习|挑战成功/)).toBeNull();
    expect(screen.getByText("2 / 4")).toBeTruthy();
  });

  it("step 2 highlights only grounded entities", async () => {
    const user = userEvent.setup();
    renderPilot();
    await user.click(screen.getByRole("button", { name: "继续" }));
    const highlighted = screen
      .getAllByRole("article")
      .filter((node) => node.getAttribute("data-highlighted") === "true");
    expect(highlighted.map((node) => node.getAttribute("data-entity-id"))).toEqual([
      "home-soup",
      "home-spoon",
    ]);
    expect(screen.getAllByText(/当前关注/)).toHaveLength(2);
  });

  it("step 3 presents contrast without a scored response", async () => {
    const user = userEvent.setup();
    renderPilot();
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByText("勺子：舀取汤或柔软食物")).toBeTruthy();
    expect(screen.getByText("叉子：叉取食物块")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "选项" })).toBeNull();
    expect(screen.queryByText(/答对了|请选择正确答案/)).toBeNull();
  });

  it("step 4 typing does not grade locally or claim mastery", async () => {
    const user = userEvent.setup();
    renderPilot();
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    const input = screen.getByLabelText("英文答案预览");
    await user.type(input, "spoon");
    expect(screen.queryByText(/答对|正确|掌握|完成学习/)).toBeNull();
    expect((input as HTMLInputElement).value).toBe("spoon");
    expect(screen.getByText("试着输入英文单词。这只是预览，不会判分。")).toBeTruthy();
  });

  it("Enter in the preview input does not navigate or grade", async () => {
    const user = userEvent.setup();
    renderPilot();
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    const input = screen.getByLabelText("英文答案预览");
    await user.type(input, "spoon{Enter}");
    expect(screen.getByLabelText("英文答案预览")).toBeTruthy();
    expect(screen.queryByText(/交接点/)).toBeNull();
    expect(screen.queryByText(/答对了|掌握了|完成学习/)).toBeNull();
  });

  it("opens the frozen-runtime boundary without completing learning", async () => {
    const user = userEvent.setup();
    renderPilot();
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "提交功能将在下一阶段接入" }));
    expect(screen.getAllByText(/交接点/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/下一阶段会通过 WordRanger 原有提交与证据流程完成这道题/)
        .length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelector('[data-pilot-state="FROZEN_TASK_HANDOFF_READY"]'),
    ).toBeTruthy();
    expect(screen.queryByText(/掌握了|完成学习|LEARNING_COMPLETED/)).toBeNull();
  });

  it("restart resets presentation state to the first Guided screen", async () => {
    const user = userEvent.setup();
    renderPilot();
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByText("2 / 4")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "重新体验" }));
    expect(screen.getByText("1 / 4")).toBeTruthy();
    expect(screen.getByText("桌上有汤、碗、勺子和叉子。先看看这些物品。")).toBeTruthy();
  });

  it("refresh-equivalent remount restarts the local presentation", async () => {
    const user = userEvent.setup();
    const payload = prepareMealContextLab();
    const { rerender } = render(<ContextLabClient payload={payload} />);
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(screen.getByText("2 / 4")).toBeTruthy();
    rerender(<ContextLabClient key="restarted" payload={payload} />);
    expect(screen.getByText("1 / 4")).toBeTruthy();
  });

  it("does not render an error screen as a successful meal", () => {
    render(
      <ContextLabClient
        payload={{
          screens: [
            {
              kind: "ERROR",
              title: "这个体验暂时无法加载。",
              message: "请稍后再试，或检查本地实验开关。",
              code: CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE,
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "这个体验暂时无法加载。" }),
    ).toBeTruthy();
    expect(within(document.body).queryByText("汤")).toBeNull();
  });
});
