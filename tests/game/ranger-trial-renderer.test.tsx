/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceTaskRenderer } from "@/components/game/ranger-trial/ChoiceTaskRenderer";
import { TextInputTaskRenderer } from "@/components/game/ranger-trial/TextInputTaskRenderer";
import { formatTaskPrompt } from "@/components/game/ranger-trial/task-prompt-copy";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { meaningChoiceTask, spellingTask } from "./helpers";

afterEach(() => {
  cleanup();
});

describe("Ranger Trial renderer", () => {
  it("R1: CHOICE task renders all options", () => {
    render(
      <ChoiceTaskRenderer
        task={meaningChoiceTask()}
        onAction={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "安静" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "完全" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "迅速" })).toBeTruthy();
  });

  it("R2/G2: CHOICE click emits option ID only", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<ChoiceTaskRenderer task={meaningChoiceTask()} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "完全" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ kind: "CHOICE", optionId: "opt-b" });
  });

  it("R3: no answerKey is required to render", () => {
    const task = meaningChoiceTask();
    expect("answerKey" in task).toBe(false);
    render(<ChoiceTaskRenderer task={task} onAction={() => undefined} />);
    expect(screen.getByText("quiet")).toBeTruthy();
  });

  it("R4/G3: TEXT_INPUT emits typed value", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<TextInputTaskRenderer task={spellingTask()} onAction={onAction} />);
    await user.type(screen.getByLabelText("英文答案"), "quiet");
    await user.click(screen.getByRole("button", { name: "提交" }));
    expect(onAction).toHaveBeenCalledWith({
      kind: "TEXT_INPUT",
      value: "quiet",
    });
  });

  it("R5: Enter submits text input", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<TextInputTaskRenderer task={spellingTask()} onAction={onAction} />);
    const input = screen.getByLabelText("英文答案");
    await user.type(input, "quiet{Enter}");
    expect(onAction).toHaveBeenCalledWith({
      kind: "TEXT_INPUT",
      value: "quiet",
    });
  });

  it("R6: empty input cannot submit", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<TextInputTaskRenderer task={spellingTask()} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "提交" }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("R7: second click while pending does not double-submit", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const task = meaningChoiceTask();
    const { rerender } = render(
      <ChoiceTaskRenderer task={task} onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: "安静" }));
    rerender(
      <ChoiceTaskRenderer task={task} disabled onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: "完全" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("R8: RELATION prompt displays student-friendly text", () => {
    const formatted = formatTaskPrompt({
      kind: "RELATION",
      sourceText: "quiet",
      relationType: LexemeRelationType.ANTONYM,
    });
    expect(formatted.instruction).toBe("选择与 quiet 构成反义关系的单词");
    expect(formatted.headline).toBe("quiet");
  });
});
