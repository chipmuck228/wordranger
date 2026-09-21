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
import { cloneMealPack, mealTestLexemeLoader } from "./helpers";

const authorities = {
  frame: homeBreakfastFrame,
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
    unknownFact.lexemes[0] = {
      ...unknownFact.lexemes[0]!,
      grounding: {
        ...unknownFact.lexemes[0]!.grounding,
        facts: [
          {
            factId: "missing-fact",
            predicate: "contains",
            args: [
              { kind: "ENTITY", entityId: "home-bowl" },
              { kind: "ENTITY", entityId: "home-soup" },
            ],
          },
        ],
      },
    };
    expect(issuesOf(unknownFact)).toContain(SceneContentErrorCode.CONTENT_FACT_NOT_BOUND_TO_FRAME);
    expect(issuesOf(unknownFact)).toContain(SceneContentErrorCode.CONTENT_FACT_NOT_FOUND);
  });

  it("rejects an orphan grounding fact that no frame accepts", () => {
    const orphan = cloneMealPack();
    orphan.lexemes[0] = {
      ...orphan.lexemes[0]!,
      grounding: {
        ...orphan.lexemes[0]!.grounding,
        facts: [
          ...orphan.lexemes[0]!.grounding.facts,
          {
            factId: "orphan-fact",
            predicate: "contains",
            args: [
              { kind: "ENTITY", entityId: "home-bowl" },
              { kind: "ENTITY", entityId: "home-soup" },
            ],
          },
        ],
      },
    };
    const result = validateSceneContent({ pack: orphan, ...authorities });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          {
            code: SceneContentErrorCode.CONTENT_FACT_NOT_BOUND_TO_FRAME,
            path: "lexemes[0].grounding.facts[1]",
          },
        ]),
      );
    }
  });

  it("rejects a connectFactId that is not on the lexeme's frame", () => {
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
    wrongPredicate.lexemes[0] = {
      ...wrongPredicate.lexemes[0]!,
      grounding: {
        ...wrongPredicate.lexemes[0]!.grounding,
        facts: [
          {
            ...wrongPredicate.lexemes[0]!.grounding.facts[0]!,
            predicate: "suitable_for",
          },
        ],
      },
    };
    expect(issuesOf(wrongPredicate)).toContain(
      SceneContentErrorCode.CONTENT_FACT_ARGUMENT_MISMATCH,
    );

    const reversed = cloneMealPack();
    reversed.lexemes[0] = {
      ...reversed.lexemes[0]!,
      grounding: {
        ...reversed.lexemes[0]!.grounding,
        facts: [
          {
            ...reversed.lexemes[0]!.grounding.facts[0]!,
            args: [
              { kind: "ENTITY", entityId: "home-soup" },
              { kind: "ENTITY", entityId: "home-bowl" },
            ],
          },
        ],
      },
    };
    expect(issuesOf(reversed)).toContain(SceneContentErrorCode.CONTENT_FACT_DIRECTION_MISMATCH);

    const reversedSuitable = cloneMealPack();
    const spoon = reversedSuitable.lexemes.find((item) => item.id === "meal-spoon")!;
    spoon.grounding = {
      ...spoon.grounding,
      facts: [
        {
          ...spoon.grounding.facts[0]!,
          args: [
            { kind: "ENTITY", entityId: "home-soup" },
            { kind: "ENTITY", entityId: "home-spoon" },
          ],
        },
      ],
    };
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
    expect(issuesOf(cloneMealPack())).toEqual([]);
    const resolved = resolveSceneContent({
      pack: MEAL_SCENE_CONTENT_PACK,
      ...authorities,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }
    const bowl = resolved.content.lexemes.find((item) => item.canonicalKey === "lex-0179-1");
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
    expect(soup?.displayForm).toBe("soup");
    expect(soup?.meaningGloss).toBe("汤");
    expect(soup?.phonetic).toBe("/suːp/");
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
    pack.frames.push({
      frameId: restaurantMealFrame.id,
      title: "餐厅",
      settingLabel: "坏的第二帧",
      entityIds: ["rest-missing"],
      factIds: ["rest-missing-fact"],
      presentationOrder: ["rest-missing"],
    });
    expect(issuesOf(pack)).toContain(SceneContentErrorCode.CONTENT_FRAME_NOT_FOUND);

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
    const pack = cloneMealPack();
    pack.frames.push({
      frameId: restaurantMealFrame.id,
      title: "餐厅",
      settingLabel: "餐厅桌上的食物和餐具。",
      entityIds: ["rest-soup", "rest-bowl", "rest-spoon", "rest-fork"],
      factIds: ["rest-fact-contains-bowl-soup", "rest-fact-suitable-for-spoon-soup"],
      presentationOrder: ["rest-soup", "rest-bowl", "rest-spoon", "rest-fork"],
    });
    const soup = pack.lexemes[0]!;
    soup.membership.frameBindings.push({
      frameId: restaurantMealFrame.id,
      entityId: "rest-soup",
      roleId: "FOOD",
      sceneOrder: 0,
    });
    pack.lexemes[1]!.membership.frameBindings.push({
      frameId: restaurantMealFrame.id,
      entityId: "rest-bowl",
      roleId: "FOOD_CONTAINER",
      sceneOrder: 1,
    });
    soup.grounding = {
      ...soup.grounding,
      facts: [
        ...soup.grounding.facts,
        {
          factId: "rest-fact-contains-bowl-soup",
          predicate: "contains",
          args: [
            { kind: "ENTITY", entityId: "rest-bowl" },
            { kind: "ENTITY", entityId: "rest-soup" },
          ],
        },
      ],
    };
    pack.lexemes[1]!.grounding = {
      ...pack.lexemes[1]!.grounding,
      facts: [
        ...pack.lexemes[1]!.grounding.facts,
        {
          factId: "rest-fact-contains-bowl-soup",
          predicate: "contains",
          args: [
            { kind: "ENTITY", entityId: "rest-bowl" },
            { kind: "ENTITY", entityId: "rest-soup" },
          ],
        },
      ],
    };
    soup.build = { ...soup.build, connectFactId: undefined };
    pack.lexemes[1]!.build = {
      ...pack.lexemes[1]!.build,
      connectFactId: undefined,
    };
    const resolvedHome = resolveSceneContent({
      pack,
      frame: homeBreakfastFrame,
      frames: [restaurantMealFrame],
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: mealTestLexemeLoader,
    });
    expect(resolvedHome.ok).toBe(true);
    if (!resolvedHome.ok) {
      return;
    }
    const homeSoup = findResolvedLexeme(resolvedHome.content, MEAL_SENSE.soup);
    expect(homeSoup?.frameId).toBe(homeBreakfastFrame.id);
    expect(homeSoup?.entityId).toBe("home-soup");

    const resolvedRestaurant = resolveSceneContent({
      pack,
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
    expect(resolvedRestaurant.content.lexemes.map((item) => item.entityId)).toEqual([
      "rest-soup",
      "rest-bowl",
    ]);
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
});
