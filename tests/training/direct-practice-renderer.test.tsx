/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectPracticeRenderer } from "@/components/training/DirectPracticeRenderer";
import { meaningChoiceTask, spellingTask } from "../game/helpers";

afterEach(() => {
  cleanup();
});

describe("DirectPracticeRenderer", () => {
  it("supports CHOICE and emits only StudentAction intent", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const task = meaningChoiceTask();
    render(
      <DirectPracticeRenderer task={task} disabled={false} onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: "安静" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ kind: "CHOICE", optionId: "opt-a" });
    expect(JSON.stringify(onAction.mock.calls[0][0])).not.toMatch(/answerKey|isCorrect|correctOptionIds/);
  });

  it("supports TEXT_INPUT and emits only StudentAction intent", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <DirectPracticeRenderer
        task={spellingTask()}
        disabled={false}
        onAction={onAction}
      />,
    );
    await user.type(screen.getByLabelText("英文答案"), "quiet");
    await user.click(screen.getByRole("button", { name: "提交" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ kind: "TEXT_INPUT", value: "quiet" });
  });

  it("does not receive or render AnswerKey fields", () => {
    const task = meaningChoiceTask();
    const serialized = JSON.stringify(task);
    expect(serialized).not.toMatch(/answerKey|correctOptionIds|expectedAnswer/);
    render(
      <DirectPracticeRenderer task={task} disabled={false} onAction={() => undefined} />,
    );
    expect(screen.queryByText(/AnswerKey/i)).toBeNull();
  });
});
