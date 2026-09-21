import { describe, expect, it } from "vitest";
import { createMealLabHarness } from "./helpers";
import { mealColdProbeTargets } from "@/server/context-lab/meal-probe-targets";
import {
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  mappedMealEntity,
} from "@/server/context-lab/meal-presentation-map";
import {
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
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
    const original = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(original.ok && original.pack.lexemes).toHaveLength(4);
    expect(screen.kind).toBe("PROBE_INTRO");
    expect(JSON.stringify(screen)).not.toContain(MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET.lexemeId);
    expect(screen.kind === "PROBE_INTRO" ? screen.context.instruction : "").not.toMatch(/cup/i);
  });
});
