import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LearningTaskType } from "@/domain/tasks/task-type";
import { mealBuildPlanningInput } from "@/server/context-lab/prepare-meal-context-lab";
import {
  assertFrozen,
  assertGuided,
  collectKeys,
  createMealLabHarness,
  FORBIDDEN_CLIENT_FIELDS,
} from "./helpers";

const CONTROLLER_SOURCE = readFileSync(
  join(process.cwd(), "src/server/context-lab/meal-context-lab-controller.ts"),
  "utf8",
);

describe("Meal Context Lab current-step presentation", () => {
  it("selects Meal BUILD through planExperience, not a hard-coded plan", async () => {
    expect(CONTROLLER_SOURCE).toContain("planExperience");
    expect(CONTROLLER_SOURCE).toContain("mealBuildPlanningInput");
    expect(CONTROLLER_SOURCE).not.toContain("createMealBuildPlan");
    expect(CONTROLLER_SOURCE).not.toMatch(/plan\.id\.startsWith|variantId\.startsWith/);
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    assertGuided(first);
    expect(first.activity.contextFrameId).toBe("home-breakfast-v0");
  });

  it("renders a controlled error when the typing capability is missing", async () => {
    const { repository, learningTasks, learning } = createMealLabHarness();
    const { MealContextLabController } = await import(
      "@/server/context-lab/meal-context-lab-controller"
    );
    const controller = new MealContextLabController({
      repository,
      learningTasks,
      learning,
      planningInput: mealBuildPlanningInput([]),
    });
    const screen = await controller.start();
    expect(screen.kind).toBe("ERROR");
    if (screen.kind !== "ERROR") {
      throw new Error("missing capability must be an error");
    }
    expect(screen.code).toContain("PLANNER_FAILURE");
  });

  it("issues one Guided screen at a time through acknowledgement", async () => {
    const { controller } = createMealLabHarness();
    const first = await controller.start();
    assertGuided(first);
    expect(first.context.highlightedEntityIds).toEqual(["home-soup"]);
    const second = await controller.acknowledge({
      runId: first.handle.runId,
      revision: first.handle.revision,
      activityId: first.activity.id,
    });
    assertGuided(second);
    expect(second.context.highlightedEntityIds).toEqual(["home-soup", "home-bowl"]);
    expect(second.context.relationCaption).toBe("碗里装着汤");
    const third = await controller.acknowledge({
      runId: second.handle.runId,
      revision: second.handle.revision,
      activityId: second.activity.id,
    });
    assertGuided(third);
    expect(third.buildPhase).toBe("TEACH");
    expect(third.context.supportReveal?.lexicalForm).toBe("soup");
  });

  it("frozen preview contains a real PublicLearningTask and no TaskAnswerKey", async () => {
    const { controller } = createMealLabHarness();
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
    expect(screen.task.taskType).toBe(LearningTaskType.ACTIVE_RECALL_TYPING);
    expect("answerKey" in screen).toBe(false);
    const keys = collectKeys(screen);
    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
  });
});
