/** @vitest-environment jsdom */

import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnakeGame } from "@/components/game/snake/SnakeGame";
import { snakePresentationFromTask } from "@/components/game/snake/snake-presentation";
import { layoutSnakeOptions } from "@/components/game/snake/snake-layout";
import { changeDirection, tickSnake } from "@/components/game/snake/snake-engine";
import type { SnakeGameHandle } from "@/components/game/snake/types";
import {
  confusableChoiceTask,
  meaningChoiceTask,
  relationChoiceTask,
  spellingTask,
} from "./helpers";

afterEach(() => {
  cleanup();
});

function renderSnake(overrides?: {
  disabled?: boolean;
  onAction?: (intent: { kind: "CHOICE"; optionId: string }) => void;
  task?: ReturnType<typeof meaningChoiceTask>;
}) {
  const onAction = overrides?.onAction ?? (() => undefined);
  const task = overrides?.task ?? meaningChoiceTask();
  const ref = createRef<SnakeGameHandle>();
  render(
    <SnakeGame
      ref={ref}
      task={task}
      current={1}
      total={8}
      disabled={overrides?.disabled}
      autoTick={false}
      onAction={onAction}
    />,
  );
  return { onAction, task, ref };
}

function collideWithFirstOption(handle: SnakeGameHandle, taskId: string) {
  const presentation = snakePresentationFromTask(meaningChoiceTask());
  if (!presentation) {
    throw new Error("expected presentation");
  }
  const placed = layoutSnakeOptions(taskId, presentation.options);
  const target = placed[0];
  let guard = 0;
  while (guard < 80) {
    const state = handle.getState();
    const head = state.body[0];
    if (head.x === target.position.x && head.y === target.position.y) {
      break;
    }
    const dx = target.position.x - head.x;
    const dy = target.position.y - head.y;
    const desired =
      dy !== 0 ? (dy > 0 ? "DOWN" : "UP") : dx > 0 ? "RIGHT" : "LEFT";
    const opposite =
      (state.direction === "RIGHT" && desired === "LEFT") ||
      (state.direction === "LEFT" && desired === "RIGHT") ||
      (state.direction === "UP" && desired === "DOWN") ||
      (state.direction === "DOWN" && desired === "UP");
    const next = opposite
      ? desired === "LEFT" || desired === "RIGHT"
        ? "DOWN"
        : "RIGHT"
      : desired;
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key:
          next === "UP"
            ? "ArrowUp"
            : next === "DOWN"
              ? "ArrowDown"
              : next === "LEFT"
                ? "ArrowLeft"
                : "ArrowRight",
      }),
    );
    const tick = handle.tick();
    if (tick?.event.kind === "OPTION_COLLISION") {
      return tick.event.optionId;
    }
    guard += 1;
  }
  return null;
}

describe("Snake renderer", () => {
  it("S9: prompt renders", () => {
    renderSnake();
    expect(screen.getByText("选出正确意思")).toBeTruthy();
    expect(screen.getByText("quiet")).toBeTruthy();
  });

  it("S10: all public options render", () => {
    const task = meaningChoiceTask();
    renderSnake({ task });
    expect(screen.getByText("安静")).toBeTruthy();
    expect(screen.getByText("完全")).toBeTruthy();
    expect(screen.getByText("迅速")).toBeTruthy();
    if (task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    for (const option of task.responseContract.options) {
      expect(document.querySelector(`[data-option-id="${option.id}"]`)).toBeTruthy();
    }
  });

  it("S11: keyboard direction changes snake", async () => {
    const { ref } = renderSnake();
    const before = ref.current?.getState();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    const tick = ref.current?.tick();
    expect(tick?.state.direction).toBe("DOWN");
    expect(tick?.state.body[0].y).toBe((before?.body[0].y ?? 0) + 1);
    expect(tick?.event.kind).toBe("MOVED");
  });

  it("S12: movement alone emits no StudentAction", () => {
    const onAction = vi.fn();
    const { ref } = renderSnake({ onAction });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
    for (let i = 0; i < 10; i += 1) {
      const tick = ref.current?.tick();
      expect(tick?.event.kind).toBe("MOVED");
    }
    expect(onAction).not.toHaveBeenCalled();
  });

  it("S13: collision with option emits exactly one CHOICE action", () => {
    const onAction = vi.fn();
    const task = meaningChoiceTask();
    const { ref } = renderSnake({ onAction, task });
    const optionId = collideWithFirstOption(ref.current!, task.id);
    expect(optionId).toBeTruthy();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ kind: "CHOICE", optionId });
  });

  it("S14: action contains only kind + optionId", () => {
    const onAction = vi.fn();
    const task = meaningChoiceTask();
    const { ref } = renderSnake({ onAction, task });
    collideWithFirstOption(ref.current!, task.id);
    expect(Object.keys(onAction.mock.calls[0][0])).toEqual(["kind", "optionId"]);
  });

  it("S15: submission lock prevents second collision action", () => {
    const onAction = vi.fn();
    const task = meaningChoiceTask();
    const { ref } = renderSnake({ onAction, task });
    collideWithFirstOption(ref.current!, task.id);
    for (let i = 0; i < 8; i += 1) {
      expect(ref.current?.tick()).toBeNull();
    }
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("S16: TEXT_INPUT task is rejected", () => {
    expect(snakePresentationFromTask(spellingTask())).toBeNull();
    renderSnake({ task: spellingTask() });
    expect(screen.queryByRole("application", { name: "贪食蛇棋盘" })).toBeNull();
  });

  it("S17: no AnswerKey is required", () => {
    const task = meaningChoiceTask();
    expect("answerKey" in task).toBe(false);
    renderSnake({ task });
    expect(screen.getByRole("application", { name: "贪食蛇棋盘" })).toBeTruthy();
  });

  it("maps meaning, relation, and confusable public tasks", () => {
    expect(snakePresentationFromTask(meaningChoiceTask())).toEqual({
      instruction: "选出正确意思",
      promptText: "quiet",
      options: [
        { id: "opt-a", text: "安静" },
        { id: "opt-b", text: "完全" },
        { id: "opt-c", text: "迅速" },
      ],
    });
    expect(snakePresentationFromTask(relationChoiceTask())?.promptText).toBe(
      "quiet",
    );
    expect(snakePresentationFromTask(relationChoiceTask())?.instruction).toBe(
      "选择与 quiet 构成反义关系的单词",
    );
    expect(snakePresentationFromTask(confusableChoiceTask())?.options.map((item) => item.id)).toEqual(
      ["opt-a", "opt-b", "opt-c"],
    );
  });

  it("direction buttons are keyboard-accessible controls", async () => {
    const user = userEvent.setup();
    const { ref } = renderSnake();
    await user.click(screen.getByRole("button", { name: "向下" }));
    const tick = ref.current?.tick();
    expect(tick?.state.direction).toBe("DOWN");
  });
});

describe("Snake engine collision helper used by renderer tests", () => {
  it("can walk a path to an option without knowing correctness", () => {
    const task = meaningChoiceTask();
    const presentation = snakePresentationFromTask(task);
    const placed = layoutSnakeOptions(task.id, presentation!.options);
    const state = changeDirection(
      {
        body: [{ x: placed[0].position.x - 1, y: placed[0].position.y }],
        direction: "RIGHT",
        pendingDirection: null,
      },
      "RIGHT",
    );
    const next = tickSnake(state, placed);
    expect(next.event).toEqual({
      kind: "OPTION_COLLISION",
      optionId: placed[0].id,
    });
  });
});
