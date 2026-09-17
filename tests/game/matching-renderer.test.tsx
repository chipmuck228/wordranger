/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchingGame } from "@/components/game/matching/MatchingGame";
import { matchingPresentationFromTask } from "@/components/game/matching/matching-presentation";
import { matchingOptionOrder } from "@/components/game/matching/matching-layout";
import {
  confusableChoiceTask,
  meaningChoiceTask,
  relationChoiceTask,
  spellingTask,
} from "./helpers";

afterEach(() => {
  cleanup();
});

function renderMatching(overrides?: {
  disabled?: boolean;
  onAction?: (intent: { kind: "CHOICE"; optionId: string }) => void;
  task?: ReturnType<typeof meaningChoiceTask>;
}) {
  const onAction = overrides?.onAction ?? (() => undefined);
  const task = overrides?.task ?? meaningChoiceTask();
  const view = render(
    <MatchingGame
      task={task}
      current={1}
      total={8}
      disabled={overrides?.disabled}
      onAction={onAction}
    />,
  );
  return { onAction, task, ...view };
}

describe("Matching renderer", () => {
  it("M1: target renders from public task", () => {
    renderMatching();
    expect(screen.getByRole("button", { name: "目标：quiet" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "连连看棋盘" })).toBeTruthy();
  });

  it("M2: all candidate options render", () => {
    const task = meaningChoiceTask();
    renderMatching({ task });
    expect(screen.getByRole("button", { name: "安静" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "完全" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "迅速" })).toBeTruthy();
    if (task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    for (const option of task.responseContract.options) {
      expect(document.querySelector(`[data-option-id="${option.id}"]`)).toBeTruthy();
    }
  });

  it("M3: target click alone emits nothing", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderMatching({ onAction });
    await user.click(screen.getByRole("button", { name: "目标：quiet" }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("M4: target + option emits one CHOICE action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderMatching({ onAction });
    await user.click(screen.getByRole("button", { name: "目标：quiet" }));
    await user.click(screen.getByRole("button", { name: "完全" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ kind: "CHOICE", optionId: "opt-b" });
  });

  it("M5: emitted action contains only selected optionId", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderMatching({ onAction });
    await user.click(screen.getByRole("button", { name: "目标：quiet" }));
    await user.click(screen.getByRole("button", { name: "安静" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "CHOICE", optionId: "opt-a" });
    expect(Object.keys(onAction.mock.calls[0][0])).toEqual(["kind", "optionId"]);
  });

  it("M6: option-before-target emits nothing", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderMatching({ onAction });
    await user.click(screen.getByRole("button", { name: "迅速" }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText("先点左边的词。")).toBeTruthy();
  });

  it("M7: pending state prevents duplicate action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const task = meaningChoiceTask();
    const { rerender } = render(
      <MatchingGame task={task} current={1} total={8} onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: "目标：quiet" }));
    await user.click(screen.getByRole("button", { name: "安静" }));
    rerender(
      <MatchingGame
        task={task}
        current={1}
        total={8}
        disabled
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole("button", { name: "完全" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("M8: new task resets partial selection", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const first = meaningChoiceTask();
    const second = {
      ...meaningChoiceTask(),
      id: "public-task-2",
    };
    const { rerender } = render(
      <MatchingGame task={first} current={1} total={8} onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: "目标：quiet" }));
    rerender(
      <MatchingGame task={second} current={2} total={8} onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: "完全" }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText("先点左边的词。")).toBeTruthy();
  });

  it("M9: TEXT_INPUT task is rejected", () => {
    expect(matchingPresentationFromTask(spellingTask())).toBeNull();
    const { container } = renderMatching({ task: spellingTask() });
    expect(container.querySelector('[aria-label="连连看棋盘"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /目标：/ })).toBeNull();
  });

  it("M10: no AnswerKey is required", () => {
    const task = meaningChoiceTask();
    expect("answerKey" in task).toBe(false);
    renderMatching({ task });
    expect(screen.getByRole("button", { name: "目标：quiet" })).toBeTruthy();
  });

  it("M11: meaning task produces correct target/instruction/options", () => {
    const presentation = matchingPresentationFromTask(meaningChoiceTask());
    expect(presentation).toEqual({
      instruction: "选出正确意思",
      targetText: "quiet",
      options: [
        { id: "opt-a", text: "安静" },
        { id: "opt-b", text: "完全" },
        { id: "opt-c", text: "迅速" },
      ],
    });
  });

  it("M12: relation task produces correct target/instruction/options", () => {
    const presentation = matchingPresentationFromTask(relationChoiceTask());
    expect(presentation).toEqual({
      instruction: "选择与 quiet 构成反义关系的单词",
      targetText: "quiet",
      options: [
        { id: "opt-a", text: "loud" },
        { id: "opt-b", text: "quite" },
        { id: "opt-c", text: "silent" },
      ],
    });
  });

  it("M13: confusable task maps from the public prompt contract", () => {
    const presentation = matchingPresentationFromTask(confusableChoiceTask());
    expect(presentation).toEqual({
      instruction: "选出容易混淆的单词",
      targetText: "quiet",
      options: [
        { id: "opt-a", text: "quite" },
        { id: "opt-b", text: "quiet" },
        { id: "opt-c", text: "quit" },
      ],
    });
  });

  it("preserves public option order", () => {
    const task = meaningChoiceTask();
    if (task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    const ids = task.responseContract.options.map((option) => option.id);
    expect(matchingOptionOrder(ids)).toEqual(["opt-a", "opt-b", "opt-c"]);
  });
});
