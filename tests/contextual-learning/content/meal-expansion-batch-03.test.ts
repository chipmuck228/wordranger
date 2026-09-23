import { describe, expect, it } from "vitest";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import {
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_03_BREAD_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET,
  MEAL_SCENE_EXPANSION_BATCH_03_PACK,
  MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_03_WATER_TARGET,
  contentFingerprintPayload,
  currentPackTargetFingerprint,
  experimentalMealContextLabPack,
  getApprovedExperimentSceneContent,
  listSceneContentRegistry,
  registryEntryFor,
  registryStatusFor,
  resolveSceneContent,
  selectBundledMeaningGloss,
  validateSceneContent,
} from "@/contextual-learning/candidate-v0/content";
import { sameLexemeSense } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import { MEAL_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import { MEAL_BATCH_02_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-02-contexts";
import { MEAL_BATCH_03_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-03-contexts";
import { mealBatch02Skeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-02-skeleton";
import { mealBatch03Skeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-03-skeleton";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";
import {
  MEAL_RELEASE_SCENE_ID,
  resolveReleaseEligiblePack,
  validateCumulativePackLineage,
} from "@/contextual-learning/candidate-v0/release";
import { productionApprovalSources } from "@/server/contextual-content-release/authority";
import {
  createContextualLexicalBuildPlan,
  createContextualLexicalStrengthenPlan,
} from "@/contextual-learning/candidate-v0/planning/create-contextual-lexical-plans";

const home = MEAL_BATCH_03_FRAMES.find((frame) => frame.id === "home-breakfast-v0")!;
const restaurant = MEAL_BATCH_03_FRAMES.find((frame) => frame.id === "restaurant-meal-v0")!;
const authoredFrames = [home, restaurant];

const AUTHORED = [
  {
    lemma: "knife",
    key: "knife" as const,
    canonicalKey: "lex-0747-1",
    senseId: "knife#eating-tool",
    meaning: "小刀",
    ipa: "/naɪf/",
    target: MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET,
    sceneOrder: 6,
  },
  {
    lemma: "bread",
    key: "bread" as const,
    canonicalKey: "lex-0184-1",
    senseId: "bread#solid-food",
    meaning: "面包",
    ipa: "/bred/",
    target: MEAL_SCENE_EXPANSION_BATCH_03_BREAD_TARGET,
    sceneOrder: 7,
  },
  {
    lemma: "water",
    key: "water" as const,
    canonicalKey: "lex-1517-1",
    senseId: "water#drinkable-liquid",
    meaning: "水",
    ipa: "/ˈwɔːtə(r)/",
    target: MEAL_SCENE_EXPANSION_BATCH_03_WATER_TARGET,
    sceneOrder: 8,
  },
] as const;

function lexemeFor(target: { lexemeId: string; senseId: string }) {
  const matches = MEAL_SCENE_EXPANSION_BATCH_03_PACK.lexemes.filter((lexeme) =>
    sameLexemeSense(lexeme.target, target),
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function inheritedFingerprintInput(
  pack: typeof MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  target: { lexemeId: string; senseId: string },
) {
  const lexeme = pack.lexemes.find((item) => sameLexemeSense(item.target, target));
  expect(lexeme).toBeTruthy();
  const payload = contentFingerprintPayload({ packId: "normalized", lexeme: lexeme! }) as Record<
    string,
    unknown
  >;
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "packId" && key !== "sourceRefs"),
  );
}

describe("Meal expansion batch 03 Candidate", () => {
  it("resolves authored words from bundled vocabulary and blocks napkin", () => {
    const dataset = loadVocabularyDataset();
    expect(
      dataset.lexemes.some((item) => /napkin/i.test(item.lemma) || /napkin/i.test(item.display)),
    ).toBe(false);
    expect(bundledSceneLexemeLoader("lex-napkin-1")).toBeNull();
    expect(MEAL_SCENE_EXPANSION_BATCH_03_PACK.lexemes).toHaveLength(9);
    expect(
      MEAL_SCENE_EXPANSION_BATCH_03_PACK.lexemes.some((item) =>
        /napkin/i.test(item.membership.presentationToken),
      ),
    ).toBe(false);

    for (const item of AUTHORED) {
      const binding = BUNDLED_LEXEME_BINDINGS[item.key];
      const bundled = bundledSceneLexemeLoader(binding.canonicalKey);
      const lexeme = lexemeFor(item.target);
      expect(binding.canonicalKey).toBe(item.canonicalKey);
      expect(bundled?.id).toBe(lexemeIdFromCanonicalKey(item.canonicalKey));
      expect(bundled?.id).toBe(bundledBindingLexemeId(binding));
      expect(lexeme.canonicalKey).toBe(item.canonicalKey);
      expect(lexeme.target.lexemeId).toBe(bundled!.id);
      expect(lexeme.target.senseId).toBe(item.senseId);
      expect(sameLexemeSense(lexeme.fixtureSense, MEAL_SENSE[item.key])).toBe(true);
      expect(lexeme.target.lexemeId).not.toBe(MEAL_SENSE[item.key].lexemeId);
      expect(bundled?.meaningsZh).toContain(item.meaning);
      expect(bundled?.ipa).toEqual([item.ipa]);
      expect(lexeme.lexicalPresentation.meaningGlossSelector).toEqual({
        kind: "EXACT_BUNDLED_VALUE",
        value: item.meaning,
      });
      expect(
        selectBundledMeaningGloss({
          meaningsZh: bundled!.meaningsZh,
          selector: lexeme.lexicalPresentation.meaningGlossSelector,
        }),
      ).toBe(item.meaning);
      expect(JSON.stringify(lexeme)).not.toContain("meaningsZh");
      expect(JSON.stringify(lexeme)).not.toContain(item.ipa);
    }
  });

  it("fail-closes missing, ambiguous, or provisional identity", () => {
    const knife = bundledSceneLexemeLoader(BUNDLED_LEXEME_BINDINGS.knife.canonicalKey)!;
    expect(selectBundledMeaningGloss({ meaningsZh: knife.meaningsZh })).toBeNull();
    expect(
      selectBundledMeaningGloss({
        meaningsZh: knife.meaningsZh,
        selector: { kind: "EXACT_BUNDLED_VALUE", value: "匕首" },
      }),
    ).toBe("匕首");
    expect(
      selectBundledMeaningGloss({
        meaningsZh: knife.meaningsZh,
        selector: { kind: "EXACT_BUNDLED_VALUE", value: "餐刀" },
      }),
    ).toBeNull();
    const missing = structuredClone(MEAL_SCENE_EXPANSION_BATCH_03_PACK);
    const knifeLexeme = missing.lexemes.find((item) => item.id === "meal-knife")!;
    knifeLexeme.lexicalPresentation.meaningGlossSelector = {
      kind: "EXACT_BUNDLED_VALUE",
      value: "餐刀",
    };
    expect(
      validateSceneContent({
        pack: missing,
        frame: home,
        frames: authoredFrames,
        skeleton: mealBatch03Skeleton,
        cluster: MEAL_SCENE_CLUSTER,
        loadLexeme: bundledSceneLexemeLoader,
      }).ok,
    ).toBe(false);
    expect(MEAL_SCENE_EXPANSION_BATCH_03_PACK.lexemes.every((item) => item.canonicalKey)).toBe(true);
    expect(
      MEAL_SCENE_EXPANSION_BATCH_03_PACK.lexemes.some((item) =>
        item.target.lexemeId.startsWith("provisional"),
      ),
    ).toBe(false);
  });

  it("keeps inherited six-word fingerprint inputs identical to batch 02", () => {
    expect(MEAL_SCENE_EXPANSION_BATCH_03_PACK.id).toBe(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID);
    expect(registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)?.parentPackId).toBe(
      MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
    );
    expect(MEAL_SCENE_EXPANSION_BATCH_03_PACK.provenance.status).toBe("CANDIDATE");
    expect(registryStatusFor(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)).toBe("CANDIDATE");
    expect(registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)?.releaseEligibility).toBe("NONE");
    expect(registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)?.promotion).toBeUndefined();
    expect(registryEntryFor(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID)?.approvalBasis).toBeUndefined();

    const inherited = MEAL_SCENE_EXPANSION_BATCH_02_PACK.lexemes;
    expect(inherited).toHaveLength(6);
    for (const parentLexeme of inherited) {
      const child = lexemeFor(parentLexeme.target);
      expect(inheritedFingerprintInput(MEAL_SCENE_EXPANSION_BATCH_02_PACK, parentLexeme.target)).toEqual(
        inheritedFingerprintInput(MEAL_SCENE_EXPANSION_BATCH_03_PACK, child.target),
      );
      expect(JSON.parse(JSON.stringify(child))).toEqual(JSON.parse(JSON.stringify(parentLexeme)));
    }
    const orders = new Set(
      MEAL_SCENE_EXPANSION_BATCH_03_PACK.lexemes.flatMap((lexeme) =>
        lexeme.membership.frameBindings
          .filter((binding) => binding.frameId === "home-breakfast-v0")
          .map((binding) => binding.sceneOrder),
      ),
    );
    expect(orders.size).toBe(9);
  });

  it("validates the nine-word pack only against isolated batch 03 frames", () => {
    expect(
      validateSceneContent({
        pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
        frame: MEAL_FRAMES[0]!,
        frames: MEAL_FRAMES.filter((item) => item.id !== "picnic-lunch-v0"),
        skeleton: mealSkeleton,
        cluster: MEAL_SCENE_CLUSTER,
        loadLexeme: bundledSceneLexemeLoader,
      }).ok,
    ).toBe(false);
    expect(
      validateSceneContent({
        pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
        frame: MEAL_BATCH_02_FRAMES[0]!,
        frames: MEAL_BATCH_02_FRAMES.filter((item) => item.id !== "picnic-lunch-v0"),
        skeleton: mealBatch02Skeleton,
        cluster: MEAL_SCENE_CLUSTER,
        loadLexeme: bundledSceneLexemeLoader,
      }).ok,
    ).toBe(false);
    const validated = validateSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
      frame: home,
      frames: authoredFrames,
      skeleton: mealBatch03Skeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    expect(validated.ok, JSON.stringify(validated)).toBe(true);
    const resolved = resolveSceneContent({
      pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
      frame: home,
      frames: authoredFrames,
      skeleton: mealBatch03Skeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: bundledSceneLexemeLoader,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      throw new Error(resolved.reason);
    }
    for (const item of AUTHORED) {
      const resolvedLexeme = resolved.content.lexemes.find((lexeme) =>
        sameLexemeSense(lexeme.target, item.target),
      );
      expect(resolvedLexeme?.meaningGloss).toBe(item.meaning);
      expect(resolvedLexeme?.phonetic).toBe(item.ipa);
      expect(resolvedLexeme?.probe.recallInstruction.toLowerCase()).not.toContain(
        resolvedLexeme!.displayForm.toLowerCase(),
      );
      const build = createContextualLexicalBuildPlan({
        frame: home,
        content: resolved.content,
        target: item.target,
        stepIdPrefix: "home",
      });
      const strengthen = createContextualLexicalStrengthenPlan({
        frame: home,
        content: resolved.content,
        target: item.target,
        stepIdPrefix: "home",
      });
      expect(build.steps.some((step) => step.purpose === "GROUND")).toBe(true);
      expect(build.steps.some((step) => step.purpose === "RECALL")).toBe(true);
      expect(strengthen.steps.length).toBeGreaterThan(0);
    }
    expect(restaurant.entityBindings.some((entity) => entity.entityId === "rest-knife")).toBe(true);
    expect(mealSkeleton.roleDefinitions.map((role) => role.id)).not.toContain("SOLID_FOOD");
    expect(mealBatch02Skeleton.roleDefinitions.map((role) => role.id)).not.toContain("SOLID_FOOD");
    expect(mealBatch03Skeleton.roleDefinitions.map((role) => role.id)).toContain("SOLID_FOOD");
  });

  it("keeps runtime, release, and Context Lab on the six-word pack", () => {
    expect(getApprovedExperimentSceneContent(MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID).ok).toBe(false);
    const runtime = experimentalMealContextLabPack();
    expect(runtime.id).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK.id);
    expect(runtime.lexemes).toHaveLength(6);
    expect(runtime.lexemes.map((item) => item.membership.presentationToken)).toEqual([
      "soup",
      "bowl",
      "spoon",
      "fork",
      "cup",
      "plate",
    ]);
    const selected = resolveReleaseEligiblePack({
      sceneClusterId: MEAL_SCENE_CLUSTER.id,
      registry: listSceneContentRegistry(),
    });
    expect(selected.ok).toBe(true);
    expect(selected.entry?.packId).toBe(MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID);
    const lineage = validateCumulativePackLineage({
      pack: MEAL_SCENE_EXPANSION_BATCH_03_PACK,
      parentPackId: MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
      registry: listSceneContentRegistry(),
      approvalSources: productionApprovalSources(),
      sceneId: MEAL_RELEASE_SCENE_ID,
    });
    expect(lineage.issues.some((issue) => issue.code === "RELEASE_FINGERPRINT_DRIFT")).toBe(false);
    expect(lineage.issues.some((issue) => issue.code === "RELEASE_REMOVAL_UNSUPPORTED")).toBe(false);
    expect(lineage.issues.some((issue) => issue.code === "RELEASE_LINEAGE_INVALID")).toBe(false);
    expect(currentPackTargetFingerprint(MEAL_SCENE_EXPANSION_BATCH_03_PACK, AUTHORED[0]!.target)).toBeTruthy();
  });
});
