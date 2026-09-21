import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  homeBreakfastFrame,
  picnicLunchFrame,
  restaurantMealFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MEAL_PROFILES, MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { MEAL_SUPPORTS } from "@/contextual-learning/candidate-v0/fixtures/meal/supports";
import {
  SceneContentErrorCode,
  getApprovedExperimentSceneContent,
  listSceneContentRegistry,
  registryStatusFor,
  resolveSceneContent,
  validateSceneContent,
} from "@/contextual-learning/candidate-v0/content";
import {
  MEAL_EXPANSION_BATCH_01_ELIGIBILITY,
  MEAL_EXPANSION_BATCH_01_WORDS,
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
  eligibilityForExpansionWord,
  executableExpansionBatch01Words,
  liveExpansionEligibilitySignals,
} from "@/contextual-learning/candidate-v0/content";
import { findResolvedLexeme } from "@/contextual-learning/candidate-v0/content/project-from-resolved";
import { snapshotSceneContentFromPack } from "@/contextual-learning/candidate-v0/content/snapshot-from-pack";
import {
  projectProbeTargets,
  projectPublicScenePresentation,
} from "@/contextual-learning/candidate-v0/content";
import {
  createExpansionBatch01LexicalBuildPlan,
  createExpansionBatch01LexicalStrengthenPlan,
  resolveExpansionBatch01ForFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/expansion-batch-01-plans";
import { isAssessableExperienceStep } from "@/contextual-learning/candidate-v0/domain/types";
import { validateExperiencePlan } from "@/contextual-learning/candidate-v0/validation/validate-experience-plan";
import { compileExperienceStep } from "@/contextual-learning/candidate-v0/compilation/compile-experience-step";
import { FROZEN_RUNTIME_CAPABILITIES } from "@/contextual-learning/candidate-v0/capabilities/capability-registry";
import { profileMap, supportMap } from "@/contextual-learning/candidate-v0/fixtures/shared";
import { compilationRequest } from "../helpers";
import { mealTestLexemeLoader } from "./helpers";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import { BUNDLED_LEXEME_BINDINGS } from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { mealColdProbeTargets } from "@/server/context-lab/meal-probe-targets";
import {
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  mappedMealEntity,
} from "@/server/context-lab/meal-presentation-map";

const authorities = {
  frame: homeBreakfastFrame,
  frames: [restaurantMealFrame],
  skeleton: mealSkeleton,
  cluster: MEAL_SCENE_CLUSTER,
  loadLexeme: mealTestLexemeLoader,
};

const capabilities = FROZEN_RUNTIME_CAPABILITIES.filter(
  (item) => item.id === "frozen-text-input:TYPE",
);

function cloneExpansionPack(): ContextualSceneContentPack {
  return structuredClone(MEAL_SCENE_EXPANSION_BATCH_01_PACK);
}

function expansionIssueCodes(
  pack: ContextualSceneContentPack,
  extras: Partial<typeof authorities> = {},
): string[] {
  const result = validateSceneContent({ pack, ...authorities, ...extras });
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

function cupLexeme(pack = MEAL_SCENE_EXPANSION_BATCH_01_PACK) {
  return pack.lexemes.find((lexeme) => lexeme.id === "meal-cup");
}

describe("Meal expansion batch 01 eligibility", () => {
  it("records an explicit result for every audited word", () => {
    expect(MEAL_EXPANSION_BATCH_01_WORDS).toEqual([
      "cup",
      "drink",
      "plate",
      "eat",
      "choose",
    ]);
    expect(MEAL_EXPANSION_BATCH_01_ELIGIBILITY.map((item) => item.word)).toEqual([
      ...MEAL_EXPANSION_BATCH_01_WORDS,
    ]);
    for (const word of MEAL_EXPANSION_BATCH_01_WORDS) {
      const row = eligibilityForExpansionWord(word);
      expect(row.result).toMatch(
        /^(ELIGIBLE_NOW|REQUIRES_FRAME_CONTENT|REQUIRES_CANDIDATE_SCHEMA|FROZEN_CAPABILITY_GAP|SENSE_REVIEW_REQUIRED)$/,
      );
      if (row.result !== "ELIGIBLE_NOW") {
        expect(row.gap.length).toBeGreaterThan(10);
        expect(row.probeEligible).toBe(false);
        expect(row.buildEligible).toBe(false);
        expect(row.strengthenEligible).toBe(false);
      }
    }
    expect(executableExpansionBatch01Words()).toEqual(["cup"]);
  });

  it("matches live catalog, skeleton, frame, and fact signals", () => {
    for (const row of MEAL_EXPANSION_BATCH_01_ELIGIBILITY) {
      const live = liveExpansionEligibilitySignals(row.word);
      expect(live.bundledLexemeId).toBe(row.bundledLexemeId);
      expect(live.canonicalKey).toBe(row.canonicalKey);
      expect(live.exactSenseId).toBe(row.exactSenseId);
      expect(live.catalogRole).toBe(row.catalogRole);
      expect(live.skeletonRoleExists).toBe(row.skeletonRoleExists);
      expect(live.frameBindingExists).toBe(row.frameBindingExists);
      expect(live.factGroundingExists).toBe(row.factGroundingExists);
      expect(live.bindingKind).toBe(row.bindingKind);
    }
  });

  it("keeps drink blocked on sense clash, not missing facts", () => {
    const drink = eligibilityForExpansionWord("drink");
    expect(drink.exactSenseId).toBe("drink#consume-liquid");
    expect(drink.catalogRole).toBe("DRINK");
    expect(drink.bindingKind).toBe("NAMES_ENTITY");
    expect(drink.frameBindingExists).toBe(true);
    expect(drink.factGroundingExists).toBe(true);
    expect(drink.result).toBe("SENSE_REVIEW_REQUIRED");
    expect(
      MEAL_SCENE_EXPANSION_BATCH_01_PACK.lexemes.some(
        (lexeme) => lexeme.canonicalKey === BUNDLED_LEXEME_BINDINGS.drink.canonicalKey,
      ),
    ).toBe(false);
  });

  it("does not add plate, eat, or choose as executable Scene Content", () => {
    expect(eligibilityForExpansionWord("plate").result).toBe("REQUIRES_FRAME_CONTENT");
    expect(eligibilityForExpansionWord("eat").result).toBe("REQUIRES_CANDIDATE_SCHEMA");
    expect(eligibilityForExpansionWord("choose").result).toBe("REQUIRES_CANDIDATE_SCHEMA");
    const keys = MEAL_SCENE_EXPANSION_BATCH_01_PACK.lexemes.map((lexeme) => lexeme.canonicalKey);
    expect(keys).not.toContain(BUNDLED_LEXEME_BINDINGS.plate.canonicalKey);
    expect(keys).not.toContain(BUNDLED_LEXEME_BINDINGS.eat.canonicalKey);
    expect(keys).not.toContain(BUNDLED_LEXEME_BINDINGS.choose.canonicalKey);
    expect(keys).not.toContain(BUNDLED_LEXEME_BINDINGS.drink.canonicalKey);
  });
});

describe("Meal expansion batch 01 bundled identity", () => {
  it("resolves cup display, meaning, and IPA only from the bundled loader", () => {
    const bundled = bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.cup.canonicalKey);
    expect(bundled).not.toBeNull();
    expect(bundled!.id).toBe(MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET.lexemeId);
    const cup = cupLexeme();
    expect(cup).toBeDefined();
    expect(cup!.target.lexemeId).toBe(bundled!.id);
    expect(cup!.canonicalKey).toBe(BUNDLED_LEXEME_BINDINGS.cup.canonicalKey);
    expect(cup!.target.senseId).toBe(MEAL_SENSE.cup.senseId);
    const resolved = resolveSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      ...authorities,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }
    const lexeme = findResolvedLexeme(resolved.content, MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET);
    expect(lexeme?.displayForm).toBe(bundled!.display.trim() || bundled!.lemma);
    expect(lexeme?.meaningGloss).toBe(bundled!.meaningsZh[0]);
    expect(lexeme?.phonetic).toBe(bundled!.ipa[0]);
    expect(JSON.stringify(cup)).not.toContain(bundled!.ipa[0] ?? "no-ipa");
    expect(JSON.stringify(cup)).not.toContain(bundled!.meaningsZh[0] ?? "no-gloss");
    expect(cup).not.toHaveProperty("displayForm");
    expect(cup).not.toHaveProperty("meaningGloss");
    expect(cup).not.toHaveProperty("ipa");
  });
});

describe("Meal expansion batch 01 frame grounding", () => {
  it("validates the Candidate pack against Home and Restaurant", () => {
    expect(
      validateSceneContent({
        pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
        ...authorities,
      }),
    ).toEqual({ ok: true });
  });

  it("binds cup to the current-frame cup entity and contains(cup, drink) fact", () => {
    const home = resolveSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      ...authorities,
    });
    const restaurant = resolveSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      frame: restaurantMealFrame,
      frames: [homeBreakfastFrame],
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(home.ok).toBe(true);
    expect(restaurant.ok).toBe(true);
    if (!home.ok || !restaurant.ok) {
      return;
    }
    const homeCup = findResolvedLexeme(home.content, MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET);
    const restCup = findResolvedLexeme(
      restaurant.content,
      MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
    );
    expect(homeCup?.entityId).toBe("home-cup");
    expect(homeCup?.roleId).toBe("DRINK_CONTAINER");
    expect(homeCup?.groundingFacts[0]).toMatchObject({
      factId: "home-fact-contains-cup-drink",
      predicate: "contains",
      args: [
        { kind: "ENTITY", entityId: "home-cup" },
        { kind: "ENTITY", entityId: "home-drink" },
      ],
    });
    expect(restCup?.entityId).toBe("rest-cup");
    expect(restCup?.groundingFacts[0]?.factId).toBe("rest-fact-contains-cup-drink");
    expect(JSON.stringify(home.content)).not.toContain("rest-cup");
    expect(JSON.stringify(home.content)).not.toContain("rest-fact-");
    expect(JSON.stringify(restaurant.content)).not.toContain("home-cup");
    expect(JSON.stringify(restaurant.content)).not.toContain("home-fact-");
    expect(JSON.stringify(home.content)).not.toContain(picnicLunchFrame.id);
  });

  it("fails closed on wrong predicate, reversed args, missing entity, or missing fact", () => {
    const wrongPredicate = cloneExpansionPack();
    const cup = cupLexeme(wrongPredicate)!;
    cup.grounding.frameFacts[0]!.facts[0]!.predicate = "suitable_for";
    expect(expansionIssueCodes(wrongPredicate)).toContain(
      SceneContentErrorCode.CONTENT_FACT_ARGUMENT_MISMATCH,
    );

    const reversed = cloneExpansionPack();
    const reversedCup = cupLexeme(reversed)!;
    reversedCup.grounding.frameFacts[0]!.facts[0]!.args = [
      { kind: "ENTITY", entityId: "home-drink" },
      { kind: "ENTITY", entityId: "home-cup" },
    ];
    expect(expansionIssueCodes(reversed)).toContain(
      SceneContentErrorCode.CONTENT_FACT_DIRECTION_MISMATCH,
    );

    const missingEntity = cloneExpansionPack();
    expect(
      expansionIssueCodes(missingEntity, {
        frame: {
          ...homeBreakfastFrame,
          entityBindings: homeBreakfastFrame.entityBindings.filter(
            (entity) => entity.entityId !== "home-cup",
          ),
        },
      }),
    ).toContain(SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME);

    const missingFact = cloneExpansionPack();
    expect(
      expansionIssueCodes(missingFact, {
        frame: {
          ...homeBreakfastFrame,
          initialFacts: homeBreakfastFrame.initialFacts.filter(
            (fact) => fact.id !== "home-fact-contains-cup-drink",
          ),
        },
      }),
    ).toContain(SceneContentErrorCode.CONTENT_FACT_NOT_FOUND);

    const crossFrame = cloneExpansionPack();
    const crossCup = cupLexeme(crossFrame)!;
    crossCup.build.connectFactByFrame = [
      { frameId: restaurantMealFrame.id, factId: "home-fact-contains-cup-drink" },
    ];
    expect(
      validateSceneContent({ pack: crossFrame, ...authorities }).ok,
    ).toBe(false);
  });
});

describe("Meal expansion batch 01 plan generation", () => {
  it("creates a BUILD plan for cup and compiles frozen typing recall", () => {
    const plan = createExpansionBatch01LexicalBuildPlan({
      frame: homeBreakfastFrame,
      target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(plan.mode).toBe("BUILD");
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.targets.some((target) => target.sense.senseId === MEAL_SENSE.cup.senseId)).toBe(
      true,
    );
    expect(JSON.stringify(plan)).toContain("home-cup");
    expect(JSON.stringify(plan)).toContain("home-drink");
    expect(JSON.stringify(plan)).not.toContain("rest-cup");
    expect(JSON.stringify(plan)).not.toContain("rest-fact-");
    expect(JSON.stringify(plan)).not.toContain("picnic-");
    const recall = plan.steps.at(-1);
    expect(recall && isAssessableExperienceStep(recall)).toBe(true);
    if (!recall || !isAssessableExperienceStep(recall)) {
      return;
    }
    const validated = validateExperiencePlan({
      plan,
      frame: homeBreakfastFrame,
      skeleton: mealSkeleton,
      capabilities,
      supportBlocks: supportMap(MEAL_SUPPORTS),
      senseProfiles: profileMap(MEAL_PROFILES),
    });
    expect(validated.ok).toBe(true);
    const compiled = compileExperienceStep(
      compilationRequest({
        plan,
        step: recall,
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        profiles: profileMap(MEAL_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.value.publicLearningTask.taskType).toBe("ACTIVE_RECALL_TYPING");
    }
  });

  it("creates a restaurant BUILD plan that stays on restaurant IDs", () => {
    const plan = createExpansionBatch01LexicalBuildPlan({
      frame: restaurantMealFrame,
      target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.contextFrameId).toBe(restaurantMealFrame.id);
    expect(JSON.stringify(plan)).toContain("rest-cup");
    expect(JSON.stringify(plan)).toContain("rest-drink");
    expect(JSON.stringify(plan)).toContain("\"presentedFactPredicates\":[\"contains\"]");
    expect(JSON.stringify(plan)).not.toContain("home-cup");
    expect(JSON.stringify(plan)).not.toContain("home-fact-");
    expect(JSON.stringify(plan)).not.toContain("picnic-");
  });

  it("creates a STRENGTHEN plan for cup on both authored frames", () => {
    const home = createExpansionBatch01LexicalStrengthenPlan({
      frame: homeBreakfastFrame,
      target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
      loadLexeme: mealTestLexemeLoader,
    });
    const restaurant = createExpansionBatch01LexicalStrengthenPlan({
      frame: restaurantMealFrame,
      target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(home.mode).toBe("STRENGTHEN");
    expect(home.steps.length).toBeGreaterThan(0);
    expect(restaurant.steps.length).toBeGreaterThan(0);
    expect(JSON.stringify(home)).toContain("home-cup");
    expect(JSON.stringify(home)).not.toContain("rest-cup");
    expect(JSON.stringify(restaurant)).toContain("rest-cup");
    expect(JSON.stringify(restaurant)).not.toContain("home-cup");
    const recall = home.steps.at(-1);
    expect(recall && isAssessableExperienceStep(recall)).toBe(true);
    if (!recall || !isAssessableExperienceStep(recall)) {
      return;
    }
    const compiled = compileExperienceStep(
      compilationRequest({
        plan: home,
        step: recall,
        frame: homeBreakfastFrame,
        skeleton: mealSkeleton,
        profiles: profileMap(MEAL_PROFILES),
      }),
    );
    expect(compiled.ok).toBe(true);
  });

  it("fails closed when the loader is missing", () => {
    const missing = createExpansionBatch01LexicalBuildPlan({
      frame: homeBreakfastFrame,
      target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
    });
    const emptyLoader = createExpansionBatch01LexicalStrengthenPlan({
      frame: homeBreakfastFrame,
      target: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
      loadLexeme: () => null,
    });
    expect(missing.steps).toEqual([]);
    expect(emptyLoader.steps).toEqual([]);
    expect(resolveExpansionBatch01ForFrame(homeBreakfastFrame)).toBeNull();
  });
});

describe("Meal expansion batch 01 approval isolation", () => {
  it("registers the batch as CANDIDATE and keeps it out of approved runtime", () => {
    expect(MEAL_SCENE_EXPANSION_BATCH_01_PACK.id).toBe(
      MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
    );
    expect(MEAL_SCENE_EXPANSION_BATCH_01_PACK.provenance.status).toBe("CANDIDATE");
    expect(registryStatusFor(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID)).toBe("CANDIDATE");
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID)).toEqual({
      ok: false,
      reason: SceneContentErrorCode.CONTENT_REGISTRY_UNAPPROVED,
    });
    const approved = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(approved.pack.lexemes).toHaveLength(4);
      expect(approved.pack.lexemes.map((lexeme) => lexeme.id)).not.toContain("meal-cup");
    }
    expect(
      listSceneContentRegistry().some(
        (entry) =>
          entry.packId === MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID &&
          entry.status === "CANDIDATE",
      ),
    ).toBe(true);
  });

  it("lets the expansion pack hold more words while Context Lab stays on the four-word probe queue", () => {
    const expansionSnapshot = snapshotSceneContentFromPack(
      MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      homeBreakfastFrame.id,
    );
    expect(expansionSnapshot?.lexemes.length).toBeGreaterThan(4);
    expect(projectProbeTargets(expansionSnapshot!).map((item) => item.entityId)).toContain(
      "home-cup",
    );
    const approvedTargets = mealColdProbeTargets();
    expect(approvedTargets).toHaveLength(4);
    expect(approvedTargets.map((item) => item.entityId)).toEqual([
      "home-soup",
      "home-bowl",
      "home-spoon",
      "home-fork",
    ]);
    expect(HOME_BREAKFAST_SCENE_ENTITY_IDS).toEqual([
      "home-soup",
      "home-bowl",
      "home-spoon",
      "home-fork",
    ]);
    expect(mappedMealEntity("home-cup")).toBeUndefined();
  });

  it("does not leak cup answers from the Candidate fixture into approved public presentation", () => {
    const approved = snapshotSceneContentFromPack(
      MEAL_SCENE_CONTENT_PACK,
      homeBreakfastFrame.id,
    );
    expect(approved).not.toBeNull();
    const cup = approved?.lexemes.find((lexeme) => lexeme.presentationToken === "cup");
    expect(cup).toBeUndefined();
    const expansion = resolveSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_01_PACK,
      ...authorities,
    });
    expect(expansion.ok).toBe(true);
    if (!expansion.ok) {
      return;
    }
    const lexeme = findResolvedLexeme(
      expansion.content,
      MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
    );
    const probe = projectPublicScenePresentation({
      stage: "PROBE_ACTIVE_RECALL",
      lexeme: lexeme!,
    });
    expect(probe.displayForm).toBeUndefined();
    expect(probe.meaningGloss).toBeUndefined();
    expect(probe.instruction.toLowerCase()).not.toContain("cup");
  });
});

describe("Meal expansion batch 01 boundaries", () => {
  it("keeps Candidate files free of a second vocabulary table and server imports", () => {
    const packSource = readFileSync(
      join(
        process.cwd(),
        "src/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-01.ts",
      ),
      "utf8",
    );
    const planSource = readFileSync(
      join(
        process.cwd(),
        "src/contextual-learning/candidate-v0/fixtures/meal/expansion-batch-01-plans.ts",
      ),
      "utf8",
    );
    expect(packSource).not.toContain("@/server/");
    expect(planSource).not.toContain("@/server/");
    expect(packSource).not.toContain("bundledSceneLexemeLoader");
    expect(planSource).not.toContain("bundledSceneLexemeLoader");
    expect(packSource).not.toContain("MEAL_SCENE_VOCAB");
    expect(packSource).not.toContain("meaningsZh");
    expect(packSource).not.toContain("/kʌp/");
    expect(planSource).not.toContain("processEvidence");
    expect(planSource).not.toContain("LearningEvidence");
  });

  it("does not invent NAMES_EVENT or action-as-entity bindings", () => {
    const domainTypes = readFileSync(
      join(process.cwd(), "src/contextual-learning/candidate-v0/domain/types.ts"),
      "utf8",
    );
    const contentTypes = readFileSync(
      join(process.cwd(), "src/contextual-learning/candidate-v0/content/types.ts"),
      "utf8",
    );
    expect(domainTypes).toContain("NAMES_ENTITY");
    expect(domainTypes).toContain("NAMES_ACTION");
    expect(domainTypes).not.toContain("NAMES_EVENT");
    expect(contentTypes).toContain("entityId: string");
    expect(contentTypes).not.toContain("eventId");
    expect(mealSkeleton.roleDefinitions.map((role) => role.id)).not.toContain(
      "CONSUME_FOOD_ACTION",
    );
    expect(mealSkeleton.roleDefinitions.map((role) => role.id)).not.toContain("SELECT_ACTION");
    expect(mealSkeleton.roleDefinitions.map((role) => role.id)).not.toContain("FOOD_SUPPORT");
  });
});
