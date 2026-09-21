import { describe, expect, it } from "vitest";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import {
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
  experimentalMealContextLabPack,
  getApprovedExperimentSceneContent,
  registryStatusFor,
  resolveSceneContent,
  validateSceneContent,
} from "@/contextual-learning/candidate-v0/content";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { MEAL_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import {
  createContextualLexicalBuildPlan,
  createContextualLexicalStrengthenPlan,
} from "@/contextual-learning/candidate-v0/planning/create-contextual-lexical-plans";

const home = MEAL_FRAMES.find((frame) => frame.id === "home-breakfast-v0")!;
const restaurant = MEAL_FRAMES.find((frame) => frame.id === "restaurant-meal-v0")!;

function plateLexeme() {
  const matches = MEAL_SCENE_EXPANSION_BATCH_02_PACK.lexemes.filter((lexeme) =>
    sameLexemeSense(lexeme.target, MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET),
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

describe("Meal expansion batch 02 plate Candidate", () => {
  it("uses the exact bundled identity and food-support sense", () => {
    const plate = plateLexeme();
    const bundled = bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.plate.canonicalKey);
    expect(plate.canonicalKey).toBe("lex-1036-1");
    expect(plate.target.lexemeId).toBe(bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.plate));
    expect(plate.target.senseId).toBe("plate#food-support");
    expect(sameLexemeSense(plate.fixtureSense, MEAL_SENSE.plate)).toBe(true);
    expect(plate.target.lexemeId).not.toBe(MEAL_SENSE.plate.lexemeId);
    expect(plate.target.senseId).toBe(MEAL_SENSE.plate.senseId);
    expect(bundled?.id).toBe(plate.target.lexemeId);
    expect(bundled?.display).toBe("plate");
    expect(bundled?.lemma).toBe("plate");
    expect(bundled?.meaningsZh).toEqual(["板", "片", "牌", "盘子", "盆子"]);
    expect(bundled?.ipa).toEqual(["/pleɪt/"]);
    expect(plate.lexicalPresentation.displayFormSource).toBe("BUNDLED_VOCABULARY");
    expect(JSON.stringify(plate)).not.toContain("meaningsZh");
    expect(JSON.stringify(plate)).not.toContain("/pleɪt/");
  });

  it("authors Home and Restaurant plate facts without disguising plate as a bowl", () => {
    const plate = plateLexeme();
    expect(plate.membership.frameBindings.map((item) => item.roleId)).toEqual([
      "FOOD_SUPPORT",
      "FOOD_SUPPORT",
    ]);
    expect(plate.membership.presentationRole).toBe("SUPPORT");
    expect(plate.contrastBindings[0]?.contrastTarget.senseId).toBe("bowl#food-container");
    for (const frame of [home, restaurant]) {
      const prefix = frame.id === restaurant.id ? "rest" : "home";
      const entity = frame.entityBindings.find((item) => item.entityId === `${prefix}-plate`);
      const food = frame.entityBindings.find((item) => item.entityId === `${prefix}-served-food`);
      const fact = frame.initialFacts.find((item) => item.id === `${prefix}-fact-supports-plate-food`);
      expect(entity?.roleId).toBe("FOOD_SUPPORT");
      expect(entity?.lexemeSenseBindings?.[0]?.sense.senseId).toBe("plate#food-support");
      expect(food?.roleId).toBe("SUPPORTED_FOOD");
      expect(food?.lexemeSenseBindings).toBeUndefined();
      expect(fact?.predicate).toBe("supports");
      expect(fact?.arguments.map((arg) => (arg.kind === "ENTITY" ? arg.entityId : ""))).toEqual([
        `${prefix}-plate`,
        `${prefix}-served-food`,
      ]);
    }
    expect(
      MEAL_SCENE_EXPANSION_BATCH_02_PACK.lexemes.some((lexeme) => lexeme.id === "meal-plate"),
    ).toBe(true);
    expect(MEAL_SCENE_EXPANSION_BATCH_01_PACK.lexemes.some((lexeme) => lexeme.id === "meal-plate")).toBe(
      false,
    );
  });

  it("validates the pack and keeps Probe from leaking the English form", () => {
    const validated = validateSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
      frame: home,
      frames: [home, restaurant],
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    expect(validated.ok, JSON.stringify(validated)).toBe(true);
    const resolved = resolveSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
      frame: home,
      frames: [home, restaurant],
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      throw new Error(resolved.reason);
    }
    const plate = resolved.content.lexemes.find((item) => item.entityId === "home-plate")!;
    expect(plate.displayForm).toBe("plate");
    expect(plate.meaningGloss).toBe("板");
    expect(plate.phonetic).toBe("/pleɪt/");
    expect(plate.probe.recallInstruction.toLowerCase()).not.toContain("plate");
    expect(plate.build.groundInstruction.toLowerCase()).not.toContain("plate");
    expect(plate.build.fadeInstruction.toLowerCase()).not.toContain("plate");
    const build = createContextualLexicalBuildPlan({
      frame: home,
      content: resolved.content,
      target: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
      stepIdPrefix: "home",
    });
    const strengthen = createContextualLexicalStrengthenPlan({
      frame: home,
      content: resolved.content,
      target: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
      stepIdPrefix: "home",
    });
    expect(build.targets.map((target) => target.id)).toEqual([
      "target-plate",
      "target-plate-form",
    ]);
    expect(build.steps.some((step) => step.purpose === "GROUND")).toBe(true);
    expect(build.steps.some((step) => step.purpose === "RECALL")).toBe(true);
    expect(
      strengthen.steps.some(
        (step) =>
          "executionIntent" in step &&
          step.executionIntent.kind === "GUIDED" &&
          step.executionIntent.guidedActivityKind === "RECONNECT_FORM",
      ),
    ).toBe(true);
  });

  it("stays CANDIDATE and out of the experimental Meal runtime", () => {
    expect(MEAL_SCENE_EXPANSION_BATCH_02_PACK.provenance.status).toBe("CANDIDATE");
    expect(registryStatusFor(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID)).toBe("CANDIDATE");
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID).ok).toBe(false);
    const runtime = experimentalMealContextLabPack();
    expect(runtime.id).toBe(MEAL_SCENE_EXPANSION_BATCH_01_PACK.id);
    expect(runtime.lexemes.map((item) => item.membership.presentationToken)).toEqual([
      "soup",
      "bowl",
      "spoon",
      "fork",
      "cup",
    ]);
    expect(MEAL_SCENE_EXPANSION_BATCH_02_PACK).not.toHaveProperty("promotion");
  });
});
