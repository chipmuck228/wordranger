import { describe, expect, it } from "vitest";
import { createMealLabHarness } from "./helpers";
import { mealColdProbeTargets } from "@/server/context-lab/meal-probe-targets";
import {
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  mappedMealEntity,
} from "@/server/context-lab/meal-presentation-map";
import {
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
} from "@/contextual-learning/candidate-v0/content";
import { BUNDLED_LEXEME_BINDINGS } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";

describe("Context Lab stays on the approved four-word Meal pack", () => {
  it("does not load the Candidate expansion batch into Probe or presentation", async () => {
    const { controller } = createMealLabHarness({ beginAt: "PROBE" });
    const screen = await controller.start();
    const payload = JSON.stringify(screen);
    expect(mealColdProbeTargets()).toHaveLength(4);
    expect(HOME_BREAKFAST_SCENE_ENTITY_IDS).toHaveLength(4);
    expect(mappedMealEntity("home-cup")).toBeUndefined();
    expect(payload).not.toContain(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID);
    expect(payload).not.toContain(MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET.lexemeId);
    expect(payload).not.toContain(BUNDLED_LEXEME_BINDINGS.cup.canonicalKey);
    expect(payload).not.toContain("home-cup");
  });
});
