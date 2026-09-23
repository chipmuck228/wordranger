/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextLabClient } from "@/app/play/context-lab/context-lab-client";
import {
  CONTEXT_LAB_AUTO_CONTINUE_FAILED_MESSAGE,
  CONTEXT_LAB_INLINE_RECORDED_STATUS,
  type ContextLabCurrentScreen,
} from "@/components/context-lab/types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
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

async function issueFirstProbePreview() {
  const harness = createMealLabHarness({ beginAt: "PROBE" });
  const intro = await harness.controller.start();
  if (intro.kind !== "PROBE_INTRO") {
    throw new Error("intro");
  }
  const preview = await harness.controller.continueProbe({
    runId: intro.handle.runId,
    revision: intro.handle.revision,
  });
  if (preview.kind !== "FROZEN_TASK_PREVIEW") {
    throw new Error("preview");
  }
  return { harness, preview };
}

describe("Context Lab inline Probe recorded", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows inline 已记录 and auto-continues once with the recorded revision", async () => {
    const { harness, preview } = await issueFirstProbePreview();
    const continueProbe = vi.fn(harness.ops.continueProbe);
    render(
      <ContextLabClient
        {...harness.ops}
        continueProbe={continueProbe}
        initialScreen={preview}
      />,
    );
    fireEvent.change(screen.getByLabelText("英文答案"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    expect((await screen.findAllByText(CONTEXT_LAB_INLINE_RECORDED_STATUS)).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole("button", { name: "继续" })).toBeNull();
    expect(screen.queryByText("答对了！")).toBeNull();
    await waitFor(() => expect(continueProbe).toHaveBeenCalledTimes(1));
    expect(continueProbe).toHaveBeenCalledWith({
      runId: preview.handle.runId,
      revision: preview.handle.revision + 1,
    });
    expect(await screen.findByText("看看这个英文词表示什么")).toBeTruthy();
    expect(document.activeElement?.id).toBe("context-lab-heading");
  });

  it("double submit writes one Evidence and auto-continues once", async () => {
    const { harness, preview } = await issueFirstProbePreview();
    const continueProbe = vi.fn(harness.ops.continueProbe);
    const submitFrozenTask = vi.fn(harness.ops.submitFrozenTask);
    render(
      <ContextLabClient
        {...harness.ops}
        submitFrozenTask={submitFrozenTask}
        continueProbe={continueProbe}
        initialScreen={preview}
      />,
    );
    fireEvent.change(screen.getByLabelText("英文答案"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    expect(submitFrozenTask).toHaveBeenCalledTimes(1);
    expect((await screen.findAllByText(CONTEXT_LAB_INLINE_RECORDED_STATUS)).length).toBeGreaterThan(
      0,
    );
    await waitFor(() => expect(continueProbe).toHaveBeenCalledTimes(1));
    expect(harness.learning.listEvidenceForUser(V1_PLACEHOLDER_USER_ID)).toHaveLength(1);
  });

  it("keeps recorded state and retries with the same revision after continue failure", async () => {
    const { harness, preview } = await issueFirstProbePreview();
    const continueProbe = vi.fn(harness.ops.continueProbe);
    continueProbe.mockRejectedValueOnce(new Error("network"));
    render(
      <ContextLabClient
        {...harness.ops}
        continueProbe={continueProbe}
        initialScreen={preview}
      />,
    );
    fireEvent.change(screen.getByLabelText("英文答案"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    expect((await screen.findAllByText(CONTEXT_LAB_INLINE_RECORDED_STATUS)).length).toBeGreaterThan(
      0,
    );
    expect(
      (await screen.findAllByText(CONTEXT_LAB_AUTO_CONTINUE_FAILED_MESSAGE)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
    expect(
      document.querySelector('[data-pilot-state="PROBE_TASK_RECORDED"]'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(continueProbe).toHaveBeenCalledTimes(2));
    expect(continueProbe.mock.calls[0]?.[0]).toEqual(continueProbe.mock.calls[1]?.[0]);
    expect(continueProbe.mock.calls[0]?.[0].revision).toBe(preview.handle.revision + 1);
    expect(await screen.findByText("看看这个英文词表示什么")).toBeTruthy();
  });

  it("reduced motion still announces recorded and continues without waiting on animation", async () => {
    mockMotion(true);
    const { harness, preview } = await issueFirstProbePreview();
    const continueProbe = vi.fn(harness.ops.continueProbe);
    render(
      <ContextLabClient
        {...harness.ops}
        continueProbe={continueProbe}
        initialScreen={preview}
      />,
    );
    fireEvent.change(screen.getByLabelText("英文答案"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    await waitFor(() => expect(continueProbe).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("看看这个英文词表示什么")).toBeTruthy();
  });

  it("cancels the auto-continue timer on unmount", async () => {
    vi.useFakeTimers();
    const { harness, preview } = await issueFirstProbePreview();
    const continueProbe = vi.fn(harness.ops.continueProbe);
    const view = render(
      <ContextLabClient
        {...harness.ops}
        continueProbe={continueProbe}
        initialScreen={preview}
      />,
    );
    fireEvent.change(screen.getByLabelText("英文答案"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getAllByText(CONTEXT_LAB_INLINE_RECORDED_STATUS).length).toBeGreaterThan(0);
    view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(continueProbe).not.toHaveBeenCalled();
  });

  it("auto-advances a same-queue BUILD recorded screen and keeps BUILD→STRENGTHEN as a button", async () => {
    const continueProbe = vi.fn(async (): Promise<ContextLabCurrentScreen> => ({
      kind: "GUIDED",
      handle: { runId: "run", revision: 4 },
      activity: {
        id: "guided:next",
        protocolVersion: "candidate-v0",
        runId: "run",
        experienceId: "exp",
        stepId: "step",
        contextFrameId: "frame",
        kind: "PRESENT_CONTEXT",
        instruction: "桌上有一把小刀。",
        completionContract: { kind: "ACKNOWLEDGE_ONLY" },
      },
      context: {
        title: "建立小刀的情境记忆",
        settingLabel: "教学阶段：建立小刀的情境记忆",
        instruction: "桌上有一把小刀。",
        entities: [{ id: "home-knife", label: "小刀", role: "TOOL" }],
        highlightedEntityIds: ["home-knife"],
      },
      progress: { current: 2, total: 2, unit: "个需要建立的词" },
      teachingPhase: true,
      buildPhase: "GROUND",
    }));
    const unused = async () => {
      throw new Error("unused");
    };
    render(
      <ContextLabClient
        start={unused}
        acknowledge={unused}
        restart={unused}
        submitFrozenTask={unused}
        continueProbe={continueProbe}
        initialScreen={{
          kind: "FROZEN_TASK_RECORDED",
          handle: { runId: "run", revision: 3 },
          feedback: { status: "CORRECT", message: "答对了！" },
          recordedMessage: "“叉子”的这次建立已记录。",
          progress: { current: 1, total: 2, unit: "个需要建立的词" },
          continueAvailable: true,
          continueLabel: "继续下一个",
        }}
      />,
    );
    expect(await screen.findByText("“叉子”的这次建立已记录。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "继续下一个" })).toBeNull();
    await waitFor(() => expect(continueProbe).toHaveBeenCalledTimes(1));
    expect(continueProbe).toHaveBeenCalledWith({ runId: "run", revision: 3 });
    expect(await screen.findByText("建立小刀的情境记忆")).toBeTruthy();

    cleanup();
    const handoffContinue = vi.fn();
    render(
      <ContextLabClient
        start={unused}
        acknowledge={unused}
        restart={unused}
        submitFrozenTask={unused}
        continueProbe={handoffContinue}
        initialScreen={{
          kind: "FROZEN_TASK_RECORDED",
          handle: { runId: "run", revision: 5 },
          feedback: { status: "CORRECT", message: "答对了！" },
          recordedMessage: "“小刀”的这次建立已记录。",
          progress: { current: 2, total: 2, unit: "个需要建立的词" },
          continueAvailable: true,
          continueLabel: "回到这次检查",
          queueCompleteMessage: "本次需要建立的词已经完成。",
        }}
      />,
    );
    expect(screen.getByText("本次需要建立的词已经完成。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "回到这次检查" })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(handoffContinue).not.toHaveBeenCalled();
  });
});
