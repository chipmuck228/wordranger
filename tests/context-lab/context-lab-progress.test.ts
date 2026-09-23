import { describe, expect, it } from "vitest";
import { MEAL_SCENE_EXPANSION_BATCH_03_PACK } from "@/contextual-learning/candidate-v0/content";
import {
  CONTEXT_LAB_BUILD_NEXT_LABEL,
  CONTEXT_LAB_BUILD_QUEUE_COMPLETE_MESSAGE,
  CONTEXT_LAB_PROBE_UNIT,
  CONTEXT_LAB_RETURN_TO_SUMMARY_LABEL,
  formatContextLabProgress,
  shouldAutoAdvanceRecorded,
  type ContextLabCurrentScreen,
} from "@/components/context-lab/types";
import {
  experiencePresentationProgress,
  presentProbeIntroScreen,
} from "@/server/context-lab/present-context-lab-screen";
import { projectMealPresentation } from "@/server/context-lab/meal-presentation-map";

describe("Context Lab progress copy", () => {
  it("formats Probe progress as target words, not scene objects", () => {
    expect(
      formatContextLabProgress({ current: 0, total: 9, unit: CONTEXT_LAB_PROBE_UNIT }),
    ).toBe("共 9 个目标词");
    expect(
      formatContextLabProgress({ current: 1, total: 9, unit: CONTEXT_LAB_PROBE_UNIT }),
    ).toBe("第 1 / 9 个目标词");
  });

  it("keeps nine Probe targets even when ten scene entities are visible", () => {
    const projected = projectMealPresentation(MEAL_SCENE_EXPANSION_BATCH_03_PACK);
    expect(projected.sceneEntityIds).toHaveLength(10);
    expect(projected.sceneEntityIds).toContain("home-water-vessel");
    const intro = presentProbeIntroScreen({
      handle: { runId: "run", revision: 0 },
      progress: { current: 0, total: 9 },
      pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
    });
    if (intro.kind !== "PROBE_INTRO") {
      throw new Error("intro");
    }
    expect(intro.context.entities).toHaveLength(10);
    expect(intro.context.entities.some((entity) => entity.id === "home-water-vessel")).toBe(
      true,
    );
    expect(intro.progress).toEqual({ current: 0, total: 9, unit: CONTEXT_LAB_PROBE_UNIT });
    expect(intro.context.instruction).toContain("辅助物品");
    expect(intro.context.instruction).toContain("9 个目标词");
    expect(intro.context.instruction).not.toMatch(/entity|frame-only|Probe target/i);
    expect(intro.context.entities.map((entity) => entity.label)).toContain("水壶");
  });

  it("uses queue position for BUILD and STRENGTHEN, not step count", () => {
    const build = experiencePresentationProgress({
      planMode: "BUILD",
      probe: {
        phase: "BUILD_HANDOFF",
        targets: [],
        currentTargetIndex: 0,
        currentSkill: null,
        issued: null,
        observations: [],
        experienceMode: "BUILD",
        buildQueue: {
          version: "build-queue-v1",
          items: [
            { target: { lexemeId: "a", senseId: "a" }, entityId: "home-fork", sourceProbeTaskIds: ["t1"] },
            { target: { lexemeId: "b", senseId: "b" }, entityId: "home-knife", sourceProbeTaskIds: ["t2"] },
          ],
          currentIndex: 0,
          completed: [],
          currentPlanId: "plan-1",
        },
      },
    });
    expect(build).toEqual({
      current: 1,
      total: 2,
      unit: "个需要建立的词",
    });
    const recorded = experiencePresentationProgress({
      planMode: "BUILD",
      recorded: true,
      probe: {
        phase: "BUILD_ITEM_RECORDED",
        targets: [],
        currentTargetIndex: 0,
        currentSkill: null,
        issued: null,
        observations: [],
        experienceMode: "BUILD",
        buildQueue: {
          version: "build-queue-v1",
          items: [
            { target: { lexemeId: "a", senseId: "a" }, entityId: "home-fork", sourceProbeTaskIds: ["t1"] },
            { target: { lexemeId: "b", senseId: "b" }, entityId: "home-knife", sourceProbeTaskIds: ["t2"] },
          ],
          currentIndex: 1,
          completed: [{ lexemeId: "a", senseId: "a" }],
          currentPlanId: "plan-1",
        },
      },
    });
    expect(recorded).toEqual({
      current: 1,
      total: 2,
      unit: "个需要建立的词",
    });
  });

  it("auto-advances only same-queue recorded screens", () => {
    const probe: ContextLabCurrentScreen = {
      kind: "PROBE_TASK_RECORDED",
      handle: { runId: "run", revision: 2 },
      progress: { current: 1, total: 9, unit: CONTEXT_LAB_PROBE_UNIT },
      message: "这次回答已记录，请继续。",
    };
    expect(shouldAutoAdvanceRecorded(probe)).toBe(true);
    expect(
      shouldAutoAdvanceRecorded({
        kind: "FROZEN_TASK_RECORDED",
        handle: { runId: "run", revision: 3 },
        feedback: { status: "CORRECT", message: "答对了！" },
        recordedMessage: "“叉子”的这次建立已记录。",
        progress: { current: 1, total: 2, unit: "个需要建立的词" },
        continueAvailable: true,
        continueLabel: CONTEXT_LAB_BUILD_NEXT_LABEL,
      }),
    ).toBe(true);
    expect(
      shouldAutoAdvanceRecorded({
        kind: "FROZEN_TASK_RECORDED",
        handle: { runId: "run", revision: 4 },
        feedback: { status: "CORRECT", message: "答对了！" },
        recordedMessage: "“小刀”的这次建立已记录。",
        progress: { current: 2, total: 2, unit: "个需要建立的词" },
        continueAvailable: true,
        continueLabel: CONTEXT_LAB_RETURN_TO_SUMMARY_LABEL,
        queueCompleteMessage: CONTEXT_LAB_BUILD_QUEUE_COMPLETE_MESSAGE,
      }),
    ).toBe(false);
  });
});
