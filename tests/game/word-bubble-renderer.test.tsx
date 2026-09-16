/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WordBubble } from "@/components/game/word-bubble/WordBubble";
import { layoutBubbleOptions } from "@/components/game/word-bubble/bubble-layout";
import { formatTaskPrompt } from "@/components/game/shared/task-prompt-copy";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { meaningChoiceTask } from "./helpers";

afterEach(() => {
  cleanup();
});

function renderBubble(overrides?: {
  disabled?: boolean;
  onAction?: (intent: { kind: "CHOICE"; optionId: string }) => void;
  task?: ReturnType<typeof meaningChoiceTask>;
}) {
  const onAction = overrides?.onAction ?? (() => undefined);
  const task = overrides?.task ?? meaningChoiceTask();
  render(
    <WordBubble
      task={task}
      current={1}
      total={8}
      disabled={overrides?.disabled}
      onAction={onAction}
    />,
  );
  return { onAction, task };
}

describe("Word Bubble renderer", () => {
  it("B1: CHOICE options render as bubbles", () => {
    renderBubble();
    expect(screen.getByRole("button", { name: "安静" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "完全" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "迅速" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "单词泡泡" })).toBeTruthy();
  });

  it("B2: all option IDs are preserved", () => {
    const task = meaningChoiceTask();
    renderBubble({ task });
    if (task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    for (const option of task.responseContract.options) {
      expect(document.querySelector(`[data-option-id="${option.id}"]`)).toBeTruthy();
    }
  });

  it("B3: click emits only selected optionId", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderBubble({ onAction });
    await user.click(screen.getByRole("button", { name: "完全" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ kind: "CHOICE", optionId: "opt-b" });
  });

  it("B4: second click while submitting is ignored", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const task = meaningChoiceTask();
    const { rerender } = render(
      <WordBubble task={task} current={1} total={8} onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: "安静" }));
    rerender(
      <WordBubble
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

  it("B5: no AnswerKey is required", () => {
    const task = meaningChoiceTask();
    expect("answerKey" in task).toBe(false);
    renderBubble({ task });
    expect(screen.getByText("quiet")).toBeTruthy();
  });

  it("B6: deterministic task produces deterministic initial layout", () => {
    const task = meaningChoiceTask();
    if (task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    const ids = task.responseContract.options.map((option) => option.id);
    expect(layoutBubbleOptions(task.id, ids)).toEqual(
      layoutBubbleOptions(task.id, ids),
    );
  });

  it("B7: different task IDs may produce different layout", () => {
    const task = meaningChoiceTask();
    if (task.responseContract.kind !== "CHOICE") {
      throw new Error("expected CHOICE");
    }
    const ids = task.responseContract.options.map((option) => option.id);
    expect(layoutBubbleOptions("task-a", ids)).not.toEqual(
      layoutBubbleOptions("task-b", ids),
    );
  });

  it("B8: student-friendly Chinese prompt renders", () => {
    renderBubble();
    expect(screen.getByText("选出正确意思")).toBeTruthy();
    const formatted = formatTaskPrompt({
      kind: "RELATION",
      sourceText: "quiet",
      relationType: LexemeRelationType.ANTONYM,
    });
    expect(formatted.instruction).toBe("选择与 quiet 构成反义关系的单词");
  });
});
