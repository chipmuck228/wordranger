import { describe, expect, it } from "vitest";
import { createMealLabHarness } from "./helpers";
import { mealColdProbeTargets } from "@/server/context-lab/meal-probe-targets";
import {
  HOME_BREAKFAST_FRAME_ENTITY_IDS,
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  mappedMealEntity,
} from "@/server/context-lab/meal-presentation-map";
import { findPlannerFrame, findPlannerSkeleton } from "@/contextual-learning/candidate-v0/planning/plan-variant-registry";
import { MEAL_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import {
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
  experimentalMealContextLabPack,
  getApprovedExperimentSceneContent,
} from "@/contextual-learning/candidate-v0/content";

describe("Context Lab uses the fingerprint-bound five-word Meal experiment pack", () => {
  it("selects the expansion pack and adds only cup", async () => {
    const { controller } = createMealLabHarness({ beginAt: "PROBE" });
    const screen = await controller.start();
    const runtime = experimentalMealContextLabPack();
    expect(runtime.id).toBe(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID);
    expect(mealColdProbeTargets()).toHaveLength(5);
    expect(mealColdProbeTargets().map((item) => item.entityId)).toEqual([
      "home-soup",
      "home-bowl",
      "home-spoon",
      "home-fork",
      "home-cup",
    ]);
    expect(HOME_BREAKFAST_SCENE_ENTITY_IDS).toContain("home-cup");
    expect(mappedMealEntity("home-cup")?.label).toBe("杯子");
    expect(mappedMealEntity("home-plate")).toBeUndefined();
    expect(HOME_BREAKFAST_FRAME_ENTITY_IDS).not.toContain("home-plate");
    expect(HOME_BREAKFAST_SCENE_ENTITY_IDS).not.toContain("home-plate");
    const plannerFrame = findPlannerFrame("home-breakfast-v0");
    expect(plannerFrame?.entityBindings.some((item) => item.entityId === "home-plate")).toBe(
      false,
    );
    expect(plannerFrame?.initialFacts.some((item) => item.id?.includes("plate"))).toBe(false);
    expect(findPlannerSkeleton("meal-setting-v0")?.roleDefinitions.map((item) => item.id)).not.toContain(
      "FOOD_SUPPORT",
    );
    expect(MEAL_FRAMES[0]).toBe(plannerFrame);
    expect(mealSkeleton.roleDefinitions.map((item) => item.id)).not.toContain("FOOD_SUPPORT");
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID).ok).toBe(
      false,
    );
    expect(runtime.lexemes.map((item) => item.id)).not.toContain("meal-plate");
    expect(JSON.stringify(screen)).not.toMatch(/home-plate|meal-plate|plate#food-support/);
    const original = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(original.ok && original.pack.lexemes).toHaveLength(4);
    expect(screen.kind).toBe("PROBE_INTRO");
    expect(JSON.stringify(screen)).not.toContain(MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET.lexemeId);
    expect(screen.kind === "PROBE_INTRO" ? screen.context.instruction : "").not.toMatch(/cup/i);
  });
});
