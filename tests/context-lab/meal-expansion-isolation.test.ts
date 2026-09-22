import { describe, expect, it } from "vitest";
import { createMealLabHarness } from "./helpers";
import { mealColdProbeTargets } from "@/server/context-lab/meal-probe-targets";
import {
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
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
  experimentalMealContextLabPack,
  getApprovedExperimentSceneContent,
} from "@/contextual-learning/candidate-v0/content";
import { experimentalMealRuntimeContextId } from "@/contextual-learning/candidate-v0/planning/meal-runtime-context";

describe("Context Lab uses the fingerprint-bound six-word Meal experiment pack", () => {
  it("selects batch 02 and keeps base frames plate-free", async () => {
    const { controller } = createMealLabHarness({ beginAt: "PROBE" });
    const screen = await controller.start();
    const runtime = experimentalMealContextLabPack();
    expect(runtime.id).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID);
    expect(experimentalMealRuntimeContextId()).toBe("MEAL_BATCH_02");
    expect(mealColdProbeTargets()).toHaveLength(6);
    expect(mealColdProbeTargets().map((item) => item.entityId)).toEqual([
      "home-soup",
      "home-bowl",
      "home-spoon",
      "home-fork",
      "home-cup",
      "home-plate",
    ]);
    expect(mealColdProbeTargets().map((item) => item.target.senseId)).not.toContain(
      "drink#consume-liquid",
    );
    expect(HOME_BREAKFAST_SCENE_ENTITY_IDS).toContain("home-cup");
    expect(HOME_BREAKFAST_SCENE_ENTITY_IDS).toContain("home-plate");
    expect(mappedMealEntity("home-cup")?.label).toBe("杯子");
    expect(mappedMealEntity("home-plate")?.label).toBe("盘子");
    const baseFrame = findPlannerFrame("home-breakfast-v0");
    expect(baseFrame?.entityBindings.some((item) => item.entityId === "home-plate")).toBe(
      false,
    );
    expect(findPlannerSkeleton("meal-setting-v0")?.roleDefinitions.map((item) => item.id)).not.toContain(
      "FOOD_SUPPORT",
    );
    expect(
      findPlannerFrame("home-breakfast-v0", "MEAL_BATCH_03")?.entityBindings.some(
        (item) => item.entityId === "home-knife",
      ),
    ).toBe(true);
    expect(
      findPlannerSkeleton("meal-setting-v0", "MEAL_BATCH_03")?.roleDefinitions.map(
        (item) => item.id,
      ),
    ).toContain("SOLID_FOOD");
    expect(MEAL_FRAMES[0]).toBe(baseFrame);
    expect(mealSkeleton.roleDefinitions.map((item) => item.id)).not.toContain("FOOD_SUPPORT");
    const batch02Frame = findPlannerFrame("home-breakfast-v0", "MEAL_BATCH_02");
    expect(batch02Frame?.entityBindings.some((item) => item.entityId === "home-plate")).toBe(
      true,
    );
    expect(
      findPlannerSkeleton("meal-setting-v0", "MEAL_BATCH_02")?.roleDefinitions.map(
        (item) => item.id,
      ),
    ).toContain("FOOD_SUPPORT");
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID).ok).toBe(
      true,
    );
    expect(runtime.lexemes.map((item) => item.id)).toContain("meal-plate");
    const original = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(original.ok && original.pack.lexemes).toHaveLength(4);
    expect(screen.kind).toBe("PROBE_INTRO");
    expect(JSON.stringify(screen)).not.toContain(MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET.lexemeId);
    expect(JSON.stringify(screen)).not.toContain(MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET.lexemeId);
    expect(screen.kind === "PROBE_INTRO" ? screen.context.instruction : "").not.toMatch(
      /cup|plate/i,
    );
  });
});
