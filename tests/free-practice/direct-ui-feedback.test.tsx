/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineTrainingFeedback } from "@/components/training/inline-training-feedback";

afterEach(() => {
  cleanup();
});

describe("Free Practice inline feedback reuse", () => {
  it("shows the public message once and can label the last item 完成", async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(
      <InlineTrainingFeedback
        feedback={{
          status: "INCORRECT",
          message: "回答不正确。",
          continueAvailable: true,
          correction: { text: "apple" },
        }}
        title="回答不正确。"
        hideCorrection
        continueLabel="完成"
        onContinue={onContinue}
      />,
    );
    expect(screen.getAllByText("回答不正确。")).toHaveLength(1);
    expect(screen.queryByText(/正确答案/)).toBeNull();
    expect(screen.queryByText("apple")).toBeNull();
    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
