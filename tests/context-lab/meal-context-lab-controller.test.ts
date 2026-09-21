import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { CONTEXT_LAB_ERROR_CODES } from "@/components/context-lab/types";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { mealBuildPlanningInput } from "@/server/context-lab/meal-context-lab-controller";
import {
  assertFrozen,
  assertGuided,
  collectKeys,
  createMealLabHarness,
  FORBIDDEN_CLIENT_FIELDS,
} from "./helpers";

const ACTIONS_SOURCE = readFileSync(
  join(process.cwd(), "src/app/play/context-lab/actions.ts"),
  "utf8",
);
const CONTROLLER_SOURCE = readFileSync(
  join(process.cwd(), "src/server/context-lab/meal-context-lab-controller.ts"),
  "utf8",
);

describe("Meal Context Lab controller", () => {
  it("start returns only the first Guided screen", async () => {
    const { controller } = createMealLabHarness();
    const screen = await controller.start();
    assertGuided(screen);
    expect(screen.progress).toEqual({ current: 1, total: 6 });
    expect(screen.activity.kind).toBe("PRESENT_CONTEXT");
    expect(screen.context.entities.map((entity) => entity.label)).toEqual([
      "汤",
      "碗",
      "勺子",
      "叉子",
    ]);
  });

  it("start does not return future screens or a full ExperienceRun", async () => {
    const { controller } = createMealLabHarness();
    const screen = await controller.start();
    const keys = collectKeys(screen);
    expect(keys.has("screens")).toBe(false);
    expect(keys.has("experienceRun")).toBe(false);
    expect(keys.has("planSnapshot")).toBe(false);
    expect(keys.has("stepRuns")).toBe(false);
    expect(JSON.stringify(screen)).not.toContain("FROZEN_TASK_PREVIEW");
    expect(JSON.stringify(screen)).not.toContain("SHOW_CONTRAST");
  });

  it("acknowledgement advances exactly one step and the client cannot select the next", async () => {
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    assertGuided(first);
    expect(CONTROLLER_SOURCE).not.toContain("nextStepIndex");
    const second = await controller.acknowledge({
      runId: first.handle.runId,
      revision: first.handle.revision,
      activityId: first.activity.id,
    });
    assertGuided(second);
    expect(second.progress).toEqual({ current: 2, total: 6 });
    expect(second.context.relationCaption).toBe("碗里装着汤");
    expect(second.handle.revision).toBe(1);
  });

  it("wrong activity ID is rejected", async () => {
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    assertGuided(first);
    const rejected = await controller.acknowledge({
      runId: first.handle.runId,
      revision: first.handle.revision,
      activityId: "guided:other:step",
    });
    expect(rejected.kind).toBe("ERROR");
    if (rejected.kind !== "ERROR") {
      throw new Error("expected error");
    }
    expect(rejected.code).toContain(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_ACK_REJECTED);
    const still = await controller.loadCurrent({ runId: first.handle.runId });
    assertGuided(still);
    expect(still.progress.current).toBe(1);
  });

  it("another run’s activity ID is rejected", async () => {
    const firstHarness = createMealLabHarness();
    const secondHarness = createMealLabHarness({
      createId: () => "00000000-0000-4000-8000-000000000222",
    });
    const a = await firstHarness.controller.start();
    const b = await secondHarness.controller.start();
    assertGuided(a);
    assertGuided(b);
    const rejected = await firstHarness.controller.acknowledge({
      runId: a.handle.runId,
      revision: a.handle.revision,
      activityId: b.activity.id,
    });
    expect(rejected.kind).toBe("ERROR");
  });

  it("stale revision is rejected", async () => {
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    assertGuided(first);
    await controller.acknowledge({
      runId: first.handle.runId,
      revision: first.handle.revision,
      activityId: first.activity.id,
    });
    const stale = await controller.acknowledge({
      runId: first.handle.runId,
      revision: first.handle.revision,
      activityId: first.activity.id,
    });
    expect(stale.kind).toBe("ERROR");
    if (stale.kind !== "ERROR") {
      throw new Error("expected stale");
    }
    expect(stale.code).toContain(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN);
  });

  it("duplicate acknowledgement cannot advance twice", async () => {
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    assertGuided(first);
    const second = await controller.acknowledge({
      runId: first.handle.runId,
      revision: first.handle.revision,
      activityId: first.activity.id,
    });
    assertGuided(second);
    const replay = await controller.acknowledge({
      runId: second.handle.runId,
      revision: second.handle.revision,
      activityId: first.activity.id,
    });
    expect(replay.kind).toBe("ERROR");
    const current = await controller.loadCurrent({ runId: second.handle.runId });
    assertGuided(current);
    expect(current.progress.current).toBe(2);
  });

  it("two concurrent acknowledgements produce one successful mutation", async () => {
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    assertGuided(first);
    const [a, b] = await Promise.all([
      controller.acknowledge({
        runId: first.handle.runId,
        revision: first.handle.revision,
        activityId: first.activity.id,
      }),
      controller.acknowledge({
        runId: first.handle.runId,
        revision: first.handle.revision,
        activityId: first.activity.id,
      }),
    ]);
    const screens = [a, b];
    const successes = screens.filter((screen) => screen.kind === "GUIDED");
    const conflicts = screens.filter((screen) => screen.kind === "ERROR");
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    if (successes[0]?.kind === "GUIDED") {
      expect(successes[0].progress.current).toBe(2);
    }
  });

  it("after five legal acknowledgements, server returns frozen task preview", async () => {
    const { controller, repository } = createMealLabHarness();
    let screen = await controller.start();
    for (let index = 0; index < 5; index += 1) {
      assertGuided(screen);
      screen = await controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      });
    }
    assertFrozen(screen);
    expect(screen.progress).toEqual({ current: 6, total: 6 });
    expect(screen.task.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect("answerKey" in screen).toBe(false);
    expect("answerKey" in screen.task).toBe(false);
    const stored = await repository.get({
      runId: screen.handle.runId,
      userId: V1_PLACEHOLDER_USER_ID,
    });
    expect(stored?.experienceRun.status).toBe("FROZEN_TASK_ISSUED");
    const rejected = await controller.acknowledge({
      runId: screen.handle.runId,
      revision: screen.handle.revision,
      activityId: "guided:any:step",
    });
    expect(rejected.kind).toBe("ERROR");
    expect(JSON.stringify(screen)).not.toContain("exactAcceptedTexts");
  });

  it("restart creates a new run ID at progress 1 / 4", async () => {
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    assertGuided(first);
    const restarted = await controller.restart();
    assertGuided(restarted);
    expect(restarted.handle.runId).not.toBe(first.handle.runId);
    expect(restarted.handle.revision).toBe(0);
    expect(restarted.progress).toEqual({ current: 1, total: 6 });
  });

  it("disabled feature gate performs no repository write", async () => {
    const { controller, repository } = createMealLabHarness({ enabled: false });
    const screen = await controller.start();
    expect(screen.kind).toBe("ERROR");
    if (screen.kind !== "ERROR") {
      throw new Error("disabled must error");
    }
    expect(screen.code).toContain(CONTEXT_LAB_ERROR_CODES.FEATURE_DISABLED);
    expect(
      await repository.get({
        runId: "00000000-0000-4000-8000-000000000001",
        userId: V1_PLACEHOLDER_USER_ID,
      }),
    ).toBeNull();
  });

  it("planner failure returns a controlled error without a run", async () => {
    const { repository, learningTasks, learning } = createMealLabHarness();
    const { MealContextLabController } = await import(
      "@/server/context-lab/meal-context-lab-controller"
    );
    const screen = await new MealContextLabController({
      repository,
      learningTasks,
      learning,
      planningInput: mealBuildPlanningInput([]),
    }).start();
    expect(screen.kind).toBe("ERROR");
    if (screen.kind !== "ERROR") {
      throw new Error("missing capability must error");
    }
    expect(screen.code).toContain(CONTEXT_LAB_ERROR_CODES.PLANNER_FAILURE);
  });

  it("server actions do not accept userId", () => {
    expect(ACTIONS_SOURCE).toContain("startMealContextLab");
    expect(ACTIONS_SOURCE).toContain("acknowledgeContextLabGuidedActivity");
    expect(ACTIONS_SOURCE).toContain("restartMealContextLab");
    expect(ACTIONS_SOURCE).toContain("submitContextLabFrozenTask");
    expect(ACTIONS_SOURCE).not.toMatch(/userId\s*:/);
    expect(ACTIONS_SOURCE).not.toMatch(/hintCount\s*:/);
    expect(ACTIONS_SOURCE).not.toMatch(/queueIndex\s*:/);
    expect(ACTIONS_SOURCE).not.toMatch(/planId\s*:/);
    expect(ACTIONS_SOURCE).not.toMatch(/disposition\s*:/);
    expect(ACTIONS_SOURCE).not.toMatch(/targetId\s*:/);
    expect(ACTIONS_SOURCE).toContain("createContextLabRuntime");
  });

  it("serialized public screens contain no forbidden fields", async () => {
    const { controller } = createMealLabHarness();
    let screen = await controller.start();
    for (let index = 0; index < 5; index += 1) {
      const keys = collectKeys(screen);
      for (const field of FORBIDDEN_CLIENT_FIELDS) {
        expect(keys.has(field), field).toBe(false);
      }
      if (screen.kind !== "GUIDED") {
        break;
      }
      screen = await controller.acknowledge({
        runId: screen.handle.runId,
        revision: screen.handle.revision,
        activityId: screen.activity.id,
      });
    }
    assertFrozen(screen);
  });
});
