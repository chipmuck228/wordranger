/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineTrainingFeedback } from "@/components/training/inline-training-feedback";

afterEach(() => {
  cleanup();
});

describe("InlineTrainingFeedback", () => {
  it("shows 答对了 once when the server message repeats it", () => {
    render(
      <InlineTrainingFeedback
        feedback={{
          status: "CORRECT",
          message: "答对了！",
          continueAvailable: true,
        }}
        onContinue={() => undefined}
      />,
    );
    expect(screen.getAllByText("答对了")).toHaveLength(1);
    expect(screen.queryByText("答对了！")).toBeNull();
  });

  it("waits for 下一题 instead of adding a second 答对了 line", async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(
      <InlineTrainingFeedback
        feedback={{
          status: "CORRECT",
          message: "答对了！",
          continueAvailable: true,
        }}
        onContinue={onContinue}
      />,
    );
    await user.click(screen.getByRole("button", { name: "下一题" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
