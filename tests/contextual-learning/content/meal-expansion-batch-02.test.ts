import { describe, expect, it } from "vitest";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import {
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
  currentPackTargetFingerprint,
  experimentalMealContextLabPack,
  fingerprintContent,
  getApprovedExperimentSceneContent,
  registryStatusFor,
  resolveSceneContent,
  selectBundledMeaningGloss,
  validateSceneContent,
} from "@/contextual-learning/candidate-v0/content";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { MEAL_FRAMES, homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  MEAL_BATCH_02_FRAMES,
  homeBreakfastBatch02Frame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-02-contexts";
import { mealBatch02Skeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-02-skeleton";
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
import { planExperience } from "@/contextual-learning/candidate-v0/planning/plan-experience";
import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";

const home = MEAL_BATCH_02_FRAMES.find((frame) => frame.id === "home-breakfast-v0")!;
const restaurant = MEAL_BATCH_02_FRAMES.find((frame) => frame.id === "restaurant-meal-v0")!;
const authoredFrames = [home, restaurant];

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
    expect(bundled?.meaningsZh[3]).toBe("盘子");
    expect(bundled?.ipa).toEqual(["/pleɪt/"]);
    expect(plate.lexicalPresentation.displayFormSource).toBe("BUNDLED_VOCABULARY");
    expect(plate.lexicalPresentation.meaningGlossSelector).toEqual({
      kind: "EXACT_BUNDLED_VALUE",
      value: "盘子",
    });
    expect(bundled?.meaningsZh).toContain(
      plate.lexicalPresentation.meaningGlossSelector?.kind === "EXACT_BUNDLED_VALUE"
        ? plate.lexicalPresentation.meaningGlossSelector.value
        : "",
    );
    expect(JSON.stringify(plate)).not.toContain("meaningsZh");
    expect(JSON.stringify(plate)).not.toContain("/pleɪt/");
  });

  it("authors Home and Restaurant plate facts on isolated batch 02 frames", () => {
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

  it("keeps approved MEAL_FRAMES and mealSkeleton free of plate extensions", () => {
    expect(
      MEAL_FRAMES.flatMap((frame) => frame.entityBindings.map((item) => item.entityId)),
    ).not.toEqual(expect.arrayContaining(["home-plate", "rest-plate"]));
    expect(
      MEAL_FRAMES.flatMap((frame) => frame.initialFacts.map((item) => item.id)),
    ).not.toEqual(expect.arrayContaining(["home-fact-supports-plate-food"]));
    expect(mealSkeleton.roleDefinitions.map((role) => role.id)).not.toContain("FOOD_SUPPORT");
    expect(mealSkeleton.roleDefinitions.map((role) => role.id)).not.toContain("SUPPORTED_FOOD");
    expect(mealSkeleton.relationDefinitions.map((item) => item.id)).not.toContain("SUPPORTS_FOOD");
    expect(MEAL_BATCH_02_FRAMES.some((frame) =>
      frame.entityBindings.some((item) => item.entityId === "home-plate"),
    )).toBe(true);
    expect(mealBatch02Skeleton.roleDefinitions.map((role) => role.id)).toContain("FOOD_SUPPORT");
    const mutated = structuredClone(homeBreakfastBatch02Frame);
    mutated.entityBindings.push({
      entityId: "home-plate-mutated",
      roleId: "FOOD_SUPPORT",
      label: "mutated",
      conceptIds: [],
    });
    expect(
      homeBreakfastFrame.entityBindings.some((item) => item.entityId === "home-plate-mutated"),
    ).toBe(false);
    expect(
      homeBreakfastBatch02Frame.entityBindings.some((item) => item.entityId === "home-plate-mutated"),
    ).toBe(false);
  });

  it("validates only against batch 02 frames/skeleton and resolves 盘子", () => {
    expect(
      validateSceneContent({
        pack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
        frame: MEAL_FRAMES[0]!,
        frames: MEAL_FRAMES.filter((item) => item.id !== "picnic-lunch-v0"),
        skeleton: mealSkeleton,
        cluster: MEAL_SCENE_CLUSTER,
        loadLexeme: bundledSceneLexemeLoader,
      }).ok,
    ).toBe(false);
    const validated = validateSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
      frame: home,
      frames: authoredFrames,
      skeleton: mealBatch02Skeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    expect(validated.ok, JSON.stringify(validated)).toBe(true);
    const resolved = resolveSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_02_PACK,
      frame: home,
      frames: authoredFrames,
      skeleton: mealBatch02Skeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      throw new Error(resolved.reason);
    }
    const plate = resolved.content.lexemes.find((item) => item.entityId === "home-plate")!;
    expect(plate.displayForm).toBe("plate");
    expect(plate.meaningGloss).toBe("盘子");
    expect(plate.meaningGloss).not.toBe("板");
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

  it("fail-closes missing or invalid meaning selectors and binds the selector into the fingerprint", () => {
    const bundled = bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.plate.canonicalKey)!;
    expect(
      selectBundledMeaningGloss({
        meaningsZh: bundled.meaningsZh,
      }),
    ).toBeNull();
    expect(
      selectBundledMeaningGloss({
        meaningsZh: bundled.meaningsZh,
        selector: { kind: "EXACT_BUNDLED_VALUE", value: "碟子" },
      }),
    ).toBeNull();
    expect(
      selectBundledMeaningGloss({
        meaningsZh: bundled.meaningsZh,
        selector: { kind: "EXACT_BUNDLED_VALUE", value: "" },
      }),
    ).toBeNull();
    expect(
      selectBundledMeaningGloss({
        meaningsZh: bundled.meaningsZh,
        selector: { kind: "BUNDLED_INDEX", index: 3 },
      }),
    ).toBe("盘子");
    const plate = plateLexeme();
    const baseline = currentPackTargetFingerprint(
      MEAL_SCENE_EXPANSION_BATCH_02_PACK,
      MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
    );
    const changed = structuredClone(plate);
    changed.lexicalPresentation.meaningGlossSelector = {
      kind: "BUNDLED_INDEX",
      index: 3,
    };
    expect(
      fingerprintContent({
        packId: MEAL_SCENE_EXPANSION_BATCH_02_PACK.id,
        lexeme: changed,
        sourceRefs: MEAL_SCENE_EXPANSION_BATCH_02_PACK.provenance.sourceRefs,
      }),
    ).not.toBe(baseline);
    const missing = structuredClone(MEAL_SCENE_EXPANSION_BATCH_02_PACK);
    const missingPlate = missing.lexemes.find((item) => item.id === "meal-plate")!;
    delete missingPlate.lexicalPresentation.meaningGlossSelector;
    expect(
      validateSceneContent({
        pack: missing,
        frame: home,
        frames: authoredFrames,
        skeleton: mealBatch02Skeleton,
        cluster: MEAL_SCENE_CLUSTER,
        loadLexeme: bundledSceneLexemeLoader,
      }).ok,
    ).toBe(false);
  });

  it("selects the six-word experimental runtime without merging packs", () => {
    expect(MEAL_SCENE_EXPANSION_BATCH_02_PACK.provenance.status).toBe(
      "APPROVED_FOR_EXPERIMENT",
    );
    expect(registryStatusFor(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID)).toBe(
      "APPROVED_FOR_EXPERIMENT",
    );
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID).ok).toBe(
      true,
    );
    const runtime = experimentalMealContextLabPack();
    expect(runtime.id).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK.id);
    expect(runtime.lexemes.map((item) => item.membership.presentationToken)).toEqual([
      "soup",
      "bowl",
      "spoon",
      "fork",
      "cup",
      "plate",
    ]);
    expect(MEAL_SCENE_EXPANSION_BATCH_01_PACK.lexemes).toHaveLength(5);
    expect(MEAL_SCENE_EXPANSION_BATCH_01_PACK.lexemes.map((item) => item.id)).not.toContain(
      "meal-plate",
    );
  });

  it("plans plate only against the batch 02 runtime context", () => {
    const typing = FROZEN_RUNTIME_CAPABILITIES.find(
      (capability) => capability.id === "frozen-text-input:TYPE",
    )!;
    const input = {
      learningNeedRef: "need-opaque-ref",
      mode: "BUILD" as const,
      targets: [
        {
          id: "target-plate-form",
          sense: MEAL_SENSE.plate,
          focus: "MEANING_TO_FORM" as const,
        },
      ],
      allowedContextIds: ["home-breakfast-v0"],
      runtimeCapabilities: [typing],
      loadLexeme: bundledSceneLexemeLoader,
    };
    expect(planExperience(input).ok).toBe(false);
    expect(planExperience({ ...input, runtimeContextId: "MEAL_BASE" }).ok).toBe(false);
    const planned = planExperience({
      ...input,
      runtimeContextId: "MEAL_BATCH_02",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      throw new Error(planned.error.message);
    }
    expect(planned.trace.selectedVariantId).toBe(
      "meal-build:home-breakfast-v0:meal-batch-02",
    );
    expect(planned.plan.targets.some((target) => target.sense.senseId === "plate#food-support")).toBe(
      true,
    );
  });
});
