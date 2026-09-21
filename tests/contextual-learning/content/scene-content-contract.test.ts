import { describe, expect, it } from "vitest";
import {
  homeBreakfastFrame,
  restaurantMealFrame,
} from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import {
  SceneContentErrorCode,
  getApprovedExperimentSceneContent,
  resolveSceneContent,
  validateSceneContent,
} from "@/contextual-learning/candidate-v0/content";
import { MEAL_SCENE_CONTENT_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { snapshotSceneContentFromPack } from "@/contextual-learning/candidate-v0/content/snapshot-from-pack";
import {
  findResolvedLexeme,
  projectProbeTargets,
  projectQueueCatalog,
} from "@/contextual-learning/candidate-v0/content/project-from-resolved";
import {
  presentationLeaksAnswer,
  projectPublicScenePresentation,
} from "@/contextual-learning/candidate-v0/content/project-public-presentation";
import {
  createContextualLexicalBuildPlan,
  createContextualLexicalStrengthenPlan,
} from "@/contextual-learning/candidate-v0/planning/create-contextual-lexical-plans";
import { readFileSync, existsSync } from "node:fs";
import { bundledVocabularyRepository } from "@/server/runtime/bundled-vocabulary";
import { cloneMealPack, mealTestLexemeLoader, replaceFrameFacts } from "./helpers";

const authorities = {
  frame: homeBreakfastFrame,
  frames: [restaurantMealFrame],
  skeleton: mealSkeleton,
  cluster: MEAL_SCENE_CLUSTER,
  loadLexeme: mealTestLexemeLoader,
};

function issuesOf(pack: ReturnType<typeof cloneMealPack>) {
  const result = validateSceneContent({ pack, ...authorities });
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("Scene Content Contract schema", () => {
  it("accepts the authored Meal four-word pack", () => {
    expect(validateSceneContent({ pack: MEAL_SCENE_CONTENT_PACK, ...authorities })).toEqual({
      ok: true,
    });
    const approved = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(approved.ok).toBe(true);
  });

  it("rejects duplicate targets and scene orders", () => {
    const duplicateTarget = cloneMealPack();
    duplicateTarget.lexemes[1] = {
      ...duplicateTarget.lexemes[1]!,
      target: { ...duplicateTarget.lexemes[0]!.target },
    };
    expect(issuesOf(duplicateTarget)).toContain(SceneContentErrorCode.CONTENT_TARGET_DUPLICATE);

    const duplicateOrder = cloneMealPack();
    duplicateOrder.lexemes[1] = {
      ...duplicateOrder.lexemes[1]!,
      membership: {
        ...duplicateOrder.lexemes[1]!.membership,
        frameBindings: [
          {
            ...duplicateOrder.lexemes[1]!.membership.frameBindings[0]!,
            sceneOrder: 0,
          },
        ],
      },
    };
    expect(issuesOf(duplicateOrder)).toContain(
      SceneContentErrorCode.CONTENT_SCENE_ORDER_DUPLICATE,
    );
  });

  it("rejects missing canonical key and bundled identity drift", () => {
    const missingKey = cloneMealPack();
    missingKey.lexemes[0] = { ...missingKey.lexemes[0]!, canonicalKey: "" };
    expect(issuesOf(missingKey)).toContain(SceneContentErrorCode.CONTENT_CANONICAL_KEY_INVALID);

    const drifted = cloneMealPack();
    drifted.lexemes[0] = {
      ...drifted.lexemes[0]!,
      target: { ...drifted.lexemes[0]!.target, lexemeId: "other-id" },
    };
    expect(issuesOf(drifted)).toContain(SceneContentErrorCode.CONTENT_BUNDLED_IDENTITY_MISMATCH);
  });

  it("rejects unknown frame, entity, role, and fact", () => {
    const unknownFrame = cloneMealPack();
    unknownFrame.frames[0] = { ...unknownFrame.frames[0]!, frameId: "missing-frame" };
    expect(issuesOf(unknownFrame)).toContain(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND);

    const unknownEntity = cloneMealPack();
    unknownEntity.lexemes[0] = {
      ...unknownEntity.lexemes[0]!,
      membership: {
        ...unknownEntity.lexemes[0]!.membership,
        frameBindings: [
          {
            ...unknownEntity.lexemes[0]!.membership.frameBindings[0]!,
            entityId: "home-missing",
          },
        ],
      },
    };
    expect(issuesOf(unknownEntity)).toContain(SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME);

    const senseMismatchFrame = structuredClone(homeBreakfastFrame);
    const soupEntity = senseMismatchFrame.entityBindings.find(
      (entity) => entity.entityId === "home-soup",
    );
    expect(soupEntity).toBeDefined();
    if (soupEntity) {
      soupEntity.lexemeSenseBindings = [];
    }
    const senseMismatch = validateSceneContent({
      pack: MEAL_SCENE_CONTENT_PACK,
      ...authorities,
      frame: senseMismatchFrame,
    });
    expect(senseMismatch.ok).toBe(false);
    if (!senseMismatch.ok) {
      expect(senseMismatch.issues.map((item) => item.code)).toContain(
        SceneContentErrorCode.CONTENT_ENTITY_SENSE_BINDING_MISMATCH,
      );
    }

    const unknownRole = cloneMealPack();
    unknownRole.lexemes[0] = {
      ...unknownRole.lexemes[0]!,
      membership: {
        ...unknownRole.lexemes[0]!.membership,
        frameBindings: [
          {
            ...unknownRole.lexemes[0]!.membership.frameBindings[0]!,
            roleId: "NOT_A_ROLE",
          },
        ],
      },
    };
    expect(issuesOf(unknownRole)).toContain(SceneContentErrorCode.CONTENT_ROLE_NOT_FOUND);

    const unknownFact = cloneMealPack();
    replaceFrameFacts(unknownFact.lexemes[0]!, [
      {
        factId: "missing-fact",
        predicate: "contains",
        args: [
          { kind: "ENTITY", entityId: "home-bowl" },
          { kind: "ENTITY", entityId: "home-soup" },
        ],
      },
    ]);
    expect(issuesOf(unknownFact)).toContain(SceneContentErrorCode.CONTENT_FACT_NOT_BOUND_TO_FRAME);
    expect(issuesOf(unknownFact)).toContain(SceneContentErrorCode.CONTENT_CONNECT_FACT_NOT_IN_FRAME);
  });

  it("rejects an orphan grounding fact that no frame accepts", () => {
    const orphan = cloneMealPack();
    const homeGroup = orphan.lexemes[0]!.grounding.frameFacts.find(
      (item) => item.frameId === homeBreakfastFrame.id,
    )!;
    replaceFrameFacts(orphan.lexemes[0]!, [
      ...homeGroup.facts,
      {
        factId: "orphan-fact",
        predicate: "contains",
        args: [
          { kind: "ENTITY", entityId: "home-bowl" },
          { kind: "ENTITY", entityId: "home-soup" },
        ],
      },
    ]);
    const result = validateSceneContent({ pack: orphan, ...authorities });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          {
            code: SceneContentErrorCode.CONTENT_FACT_NOT_BOUND_TO_FRAME,
            path: "lexemes[0].grounding.frameFacts[0].facts[1]",
          },
        ]),
      );
    }
  });

  it("rejects a connect fact that is not on the lexeme's frame", () => {
    const pack = cloneMealPack();
    pack.frames[0] = {
      ...pack.frames[0]!,
      factIds: pack.frames[0]!.factIds.filter(
        (factId) => factId !== "home-fact-contains-bowl-soup",
      ),
    };
    const result = validateSceneContent({ pack, ...authorities });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((item) => item.code)).toEqual(
        expect.arrayContaining([
          SceneContentErrorCode.CONTENT_FACT_NOT_BOUND_TO_FRAME,
          SceneContentErrorCode.CONTENT_CONNECT_FACT_NOT_IN_FRAME,
        ]),
      );
    }
  });

  it("rejects a restaurant connect fact that is not in that frame's grounding", () => {
    const pack = cloneMealPack();
    pack.lexemes[0]!.build = {
      ...pack.lexemes[0]!.build,
      connectFactByFrame: [
        { frameId: homeBreakfastFrame.id, factId: "home-fact-contains-bowl-soup" },
        { frameId: restaurantMealFrame.id, factId: "home-fact-contains-bowl-soup" },
      ],
    };
    expect(issuesOf(pack)).toContain(SceneContentErrorCode.CONTENT_CONNECT_FACT_NOT_IN_FRAME);
  });

  it("rejects reversed restaurant contains(bowl, soup)", () => {
    const pack = cloneMealPack();
    replaceFrameFacts(
      pack.lexemes[0]!,
      [
        {
          factId: "rest-fact-contains-bowl-soup",
          predicate: "contains",
          args: [
            { kind: "ENTITY", entityId: "rest-soup" },
            { kind: "ENTITY", entityId: "rest-bowl" },
          ],
          caption: "碗里装着汤",
        },
      ],
      restaurantMealFrame.id,
    );
    expect(issuesOf(pack)).toContain(SceneContentErrorCode.CONTENT_FACT_DIRECTION_MISMATCH);
  });

  it("rejects unknown fields with a precise path", () => {
    const pack = cloneMealPack();
    (pack.lexemes[0]!.build as unknown as Record<string, unknown>).inventedPolicy = true;
    (pack.lexemes[0]!.build as unknown as Record<string, unknown>).conectInstruction =
      pack.lexemes[0]!.build.connectInstruction;
    const result = validateSceneContent({ pack, ...authorities });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          {
            code: SceneContentErrorCode.CONTENT_UNKNOWN_FIELD,
            path: "lexemes[0].build.inventedPolicy",
          },
          {
            code: SceneContentErrorCode.CONTENT_UNKNOWN_FIELD,
            path: "lexemes[0].build.conectInstruction",
          },
        ]),
      );
    }
  });

  it("rejects wrong predicate and reversed contains(bowl, soup)", () => {
    const wrongPredicate = cloneMealPack();
    const homeSoupFacts = wrongPredicate.lexemes[0]!.grounding.frameFacts.find(
      (item) => item.frameId === homeBreakfastFrame.id,
    )!.facts;
    replaceFrameFacts(wrongPredicate.lexemes[0]!, [
      { ...homeSoupFacts[0]!, predicate: "suitable_for" },
    ]);
    expect(issuesOf(wrongPredicate)).toContain(
      SceneContentErrorCode.CONTENT_FACT_ARGUMENT_MISMATCH,
    );

    const reversed = cloneMealPack();
    const reversedHome = reversed.lexemes[0]!.grounding.frameFacts.find(
      (item) => item.frameId === homeBreakfastFrame.id,
    )!.facts;
    replaceFrameFacts(reversed.lexemes[0]!, [
      {
        ...reversedHome[0]!,
        args: [
          { kind: "ENTITY", entityId: "home-soup" },
          { kind: "ENTITY", entityId: "home-bowl" },
        ],
      },
    ]);
    expect(issuesOf(reversed)).toContain(SceneContentErrorCode.CONTENT_FACT_DIRECTION_MISMATCH);

    const reversedSuitable = cloneMealPack();
    const spoon = reversedSuitable.lexemes.find((item) => item.id === "meal-spoon")!;
    const spoonHome = spoon.grounding.frameFacts.find(
      (item) => item.frameId === homeBreakfastFrame.id,
    )!.facts;
    replaceFrameFacts(spoon, [
      {
        ...spoonHome[0]!,
        args: [
          { kind: "ENTITY", entityId: "home-soup" },
          { kind: "ENTITY", entityId: "home-spoon" },
        ],
      },
    ]);
    expect(issuesOf(reversedSuitable)).toContain(
      SceneContentErrorCode.CONTENT_FACT_DIRECTION_MISMATCH,
    );
  });

  it("rejects missing or self contrast and recall form leaks", () => {
    const missingContrast = cloneMealPack();
    missingContrast.lexemes[0] = {
      ...missingContrast.lexemes[0]!,
      contrastBindings: [
        {
          kind: "ROLE_CONTRAST",
          contrastTarget: { lexemeId: "missing", senseId: "missing" },
          instruction: "对比",
        },
      ],
    };
    expect(issuesOf(missingContrast)).toContain(
      SceneContentErrorCode.CONTENT_CONTRAST_TARGET_NOT_FOUND,
    );

    const selfContrast = cloneMealPack();
    selfContrast.lexemes[0] = {
      ...selfContrast.lexemes[0]!,
      contrastBindings: [
        {
          kind: "ROLE_CONTRAST",
          contrastTarget: { ...selfContrast.lexemes[0]!.target },
          instruction: "自己",
        },
      ],
    };
    expect(issuesOf(selfContrast)).toContain(SceneContentErrorCode.CONTENT_CONTRAST_SELF);

    const leak = cloneMealPack();
    leak.lexemes[0] = {
      ...leak.lexemes[0]!,
      probe: { ...leak.lexemes[0]!.probe, recallInstruction: "写出 soup" },
    };
    expect(issuesOf(leak)).toContain(SceneContentErrorCode.CONTENT_RECALL_LEAKS_FORM);
  });

  it("rejects incomplete BUILD/STRENGTHEN profiles", () => {
    const incompleteBuild = cloneMealPack();
    incompleteBuild.lexemes[0] = {
      ...incompleteBuild.lexemes[0]!,
      build: { ...incompleteBuild.lexemes[0]!.build, teachInstruction: "" },
    };
    expect(issuesOf(incompleteBuild)).toContain(
      SceneContentErrorCode.CONTENT_BUILD_PROFILE_INCOMPLETE,
    );

    const incompleteStrengthen = cloneMealPack();
    incompleteStrengthen.lexemes[0] = {
      ...incompleteStrengthen.lexemes[0]!,
      strengthen: { ...incompleteStrengthen.lexemes[0]!.strengthen, fadeInstruction: "" },
    };
    expect(issuesOf(incompleteStrengthen)).toContain(
      SceneContentErrorCode.CONTENT_STRENGTHEN_PROFILE_INCOMPLETE,
    );
  });

  it("allows missing IPA without inventing one", () => {
    const loadLexeme = (canonicalKey: string) => {
      const bundled = mealTestLexemeLoader(canonicalKey);
      return bundled ? { ...bundled, ipa: [] } : null;
    };
    expect(
      validateSceneContent({
        pack: cloneMealPack(),
        frame: homeBreakfastFrame,
        frames: [restaurantMealFrame],
        skeleton: mealSkeleton,
        cluster: MEAL_SCENE_CLUSTER,
        loadLexeme,
      }),
    ).toEqual({ ok: true });
    const resolved = resolveSceneContent({
      pack: MEAL_SCENE_CONTENT_PACK,
      frame: homeBreakfastFrame,
      frames: [restaurantMealFrame],
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }
    const bowl = resolved.content.lexemes.find((item) => item.canonicalKey === "lex-0179-1");
    expect(bowl?.displayForm).toBe("bowl");
    expect(bowl?.phonetic).toBeUndefined();
  });
});

describe("Scene Content resolver", () => {
  it("resolves bundled four-word identity, forms, and facts", () => {
    const resolved = resolveSceneContent({
      pack: MEAL_SCENE_CONTENT_PACK,
      ...authorities,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }
    const soup = findResolvedLexeme(resolved.content, MEAL_SENSE.soup);
    const bowl = findResolvedLexeme(resolved.content, MEAL_SENSE.bowl);
    const bundledSoup = bundledVocabularyRepository().getLexemeByCanonicalKey("lex-1300-1");
    const bundledBowl = bundledVocabularyRepository().getLexemeByCanonicalKey("lex-0179-1");
    expect(soup?.displayForm).toBe(bundledSoup?.display);
    expect(soup?.meaningGloss).toBe(bundledSoup?.meaningsZh[0]);
    expect(soup?.phonetic).toBe(bundledSoup?.ipa[0]);
    expect(bowl?.displayForm).toBe(bundledBowl?.display);
    expect(bowl?.meaningGloss).toBe(bundledBowl?.meaningsZh[0]);
    expect(bowl?.phonetic).toBe(bundledBowl?.ipa[0]);
    expect(bundledBowl?.ipa[0]).toBeTruthy();
    expect(soup?.target.lexemeId).toBeTruthy();
    expect(soup?.groundingFacts[0]).toMatchObject({
      predicate: "contains",
      args: [
        { kind: "ENTITY", entityId: "home-bowl" },
        { kind: "ENTITY", entityId: "home-soup" },
      ],
    });
    expect(() => {
      resolved.content.lexemes[0]!.displayForm = "mutated";
    }).toThrow();
    const again = resolveSceneContent({
      pack: MEAL_SCENE_CONTENT_PACK,
      ...authorities,
    });
    expect(again.ok && again.content.lexemes[0]?.displayForm).toBe("soup");
  });

  it("fails closed on an invalid pack and does not fall back", () => {
    const pack = cloneMealPack();
    pack.id = "";
    const resolved = resolveSceneContent({ pack, ...authorities });
    expect(resolved.ok).toBe(false);
  });
});

describe("Meal four-word migration", () => {
  it.each([MEAL_SENSE.soup, MEAL_SENSE.bowl, MEAL_SENSE.spoon, MEAL_SENSE.fork])(
    "projects probe, plans, and presentation for %s",
    (sense) => {
      const resolved = resolveSceneContent({
        pack: MEAL_SCENE_CONTENT_PACK,
        ...authorities,
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) {
        return;
      }
      const lexeme = findResolvedLexeme(resolved.content, sense);
      expect(lexeme).not.toBeNull();
      expect(projectProbeTargets(resolved.content).some((item) => item.entityId === lexeme?.entityId)).toBe(
        true,
      );
      expect(projectQueueCatalog(resolved.content).some((item) => item.entityId === lexeme?.entityId)).toBe(
        true,
      );
      const build = createContextualLexicalBuildPlan({
        frame: homeBreakfastFrame,
        content: resolved.content,
        target: sense,
        stepIdPrefix: "home",
      });
      expect(build.mode).toBe("BUILD");
      expect(build.steps).toHaveLength(6);
      expect(JSON.stringify(build)).not.toMatch(/answerKey|correctCandidateIds/i);
      const strengthen = createContextualLexicalStrengthenPlan({
        frame: homeBreakfastFrame,
        content: resolved.content,
        target: sense,
        stepIdPrefix: "home",
      });
      expect(strengthen.mode).toBe("STRENGTHEN");
      expect(strengthen.steps).toHaveLength(3);
      const teach = projectPublicScenePresentation({
        stage: "BUILD_TEACH",
        lexeme: lexeme!,
      });
      expect(teach.displayForm).toBe(lexeme!.displayForm);
      const verify = projectPublicScenePresentation({
        stage: "BUILD_VERIFY",
        lexeme: lexeme!,
      });
      expect(verify.displayForm).toBeUndefined();
      expect(presentationLeaksAnswer(verify, lexeme!.displayForm)).toBe(false);
    },
  );

  it("keeps snapshot projection aligned with the pack", () => {
    const snapshot = snapshotSceneContentFromPack(
      MEAL_SCENE_CONTENT_PACK,
      "home-breakfast-v0",
    );
    expect(snapshot?.lexemes.map((item) => item.presentationToken)).toEqual([
      "soup",
      "bowl",
      "spoon",
      "fork",
    ]);
  });
});

describe("Scene Content multi-frame and safety", () => {
  it("rejects nested Evidence/mastery fields", () => {
    const pack = cloneMealPack();
    (pack.lexemes[0]!.build as unknown as Record<string, unknown>).masteryScore = 9;
    expect(issuesOf(pack)).toContain(SceneContentErrorCode.CONTENT_OUTCOME_FORBIDDEN);

    const framed = cloneMealPack();
    (framed.frames[0] as unknown as Record<string, unknown>).evidenceOutcome =
      "INDEPENDENT_CORRECT";
    expect(issuesOf(framed)).toContain(SceneContentErrorCode.CONTENT_OUTCOME_FORBIDDEN);
  });

  it("validates every pack frame, not only the current runtime frame", () => {
    const pack = cloneMealPack();
    pack.frames[1] = {
      ...pack.frames[1]!,
      entityIds: ["rest-missing"],
      factIds: ["rest-missing-fact"],
      presentationOrder: ["rest-missing"],
    };
    const withRuntime = validateSceneContent({
      pack,
      frame: homeBreakfastFrame,
      frames: [restaurantMealFrame],
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(withRuntime.ok).toBe(false);
    if (!withRuntime.ok) {
      expect(withRuntime.issues.map((item) => item.code)).toEqual(
        expect.arrayContaining([
          SceneContentErrorCode.CONTENT_ENTITY_NOT_IN_FRAME,
          SceneContentErrorCode.CONTENT_FACT_NOT_FOUND,
        ]),
      );
    }
  });

  it("resolves only the current frame and never uses frameBindings[0] as a proxy", () => {
    const resolvedHome = resolveSceneContent({
      pack: MEAL_SCENE_CONTENT_PACK,
      ...authorities,
    });
    expect(resolvedHome.ok).toBe(true);
    if (!resolvedHome.ok) {
      return;
    }
    const homeSoup = findResolvedLexeme(resolvedHome.content, MEAL_SENSE.soup);
    expect(homeSoup?.frameId).toBe(homeBreakfastFrame.id);
    expect(homeSoup?.entityId).toBe("home-soup");
    expect(homeSoup?.build.connectFactId).toBe("home-fact-contains-bowl-soup");
    expect(homeSoup?.groundingFacts.map((item) => item.factId)).toEqual([
      "home-fact-contains-bowl-soup",
    ]);

    const resolvedRestaurant = resolveSceneContent({
      pack: MEAL_SCENE_CONTENT_PACK,
      frame: restaurantMealFrame,
      frames: [homeBreakfastFrame],
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(resolvedRestaurant.ok).toBe(true);
    if (!resolvedRestaurant.ok) {
      return;
    }
    const restSoup = findResolvedLexeme(resolvedRestaurant.content, MEAL_SENSE.soup);
    expect(restSoup?.frameId).toBe(restaurantMealFrame.id);
    expect(restSoup?.entityId).toBe("rest-soup");
    expect(restSoup?.build.connectFactId).toBe("rest-fact-contains-bowl-soup");
    expect(restSoup?.groundingFacts).toEqual([
      {
        factId: "rest-fact-contains-bowl-soup",
        predicate: "contains",
        args: [
          { kind: "ENTITY", entityId: "rest-bowl" },
          { kind: "ENTITY", entityId: "rest-soup" },
        ],
        caption: "碗里装着汤",
      },
    ]);
    expect(resolvedRestaurant.content.lexemes.map((item) => item.entityId)).toEqual([
      "rest-soup",
      "rest-bowl",
      "rest-spoon",
      "rest-fork",
    ]);
    expect(JSON.stringify(resolvedRestaurant.content.lexemes)).not.toContain("home-soup");
    expect(JSON.stringify(resolvedRestaurant.content.lexemes)).not.toContain("home-fact-");
  });

  it("does not plan from a restaurant snapshot when the runtime facts do not match", () => {
    const snapshot = snapshotSceneContentFromPack(
      MEAL_SCENE_CONTENT_PACK,
      restaurantMealFrame.id,
    );
    expect(snapshot).not.toBeNull();
    const missing = createContextualLexicalBuildPlan({
      frame: { ...restaurantMealFrame, initialFacts: [] },
      content: snapshot!,
      target: MEAL_SENSE.soup,
      stepIdPrefix: "rest",
    });
    const reversed = createContextualLexicalBuildPlan({
      frame: {
        ...restaurantMealFrame,
        initialFacts: restaurantMealFrame.initialFacts.map((item) =>
          item.id === "rest-fact-contains-bowl-soup"
            ? { ...item, arguments: [...item.arguments].reverse() }
            : item,
        ),
      },
      content: snapshot!,
      target: MEAL_SENSE.soup,
      stepIdPrefix: "rest",
    });
    expect(missing.steps).toEqual([]);
    expect(reversed.steps).toEqual([]);
  });

  it("returns an immutable registry pack copy", () => {
    const first = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(() => {
      first.pack.lexemes.pop();
    }).toThrow();
    const second = getApprovedExperimentSceneContent(MEAL_SCENE_CONTENT_PACK.id);
    expect(second.ok && second.pack.lexemes).toHaveLength(4);
  });

  it("does not keep a local Meal display/meaning/IPA table", () => {
    expect(
      existsSync(
        "src/contextual-learning/candidate-v0/fixtures/meal/scene-lexeme-loader.ts",
      ),
    ).toBe(false);
    const plans = readFileSync(
      "src/contextual-learning/candidate-v0/fixtures/meal/plans.ts",
      "utf8",
    );
    expect(plans).toContain("bundledSceneLexemeLoader");
    expect(plans).not.toContain("MEAL_SCENE_VOCAB");
    expect(plans).not.toContain("/suːp/");
    expect(plans).not.toContain("匙，调羹");
  });
});
