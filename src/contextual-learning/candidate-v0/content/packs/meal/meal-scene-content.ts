/**
 * Meal Scene Content pack: Home Breakfast and Restaurant Meal.
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Authored four-word fixture only. Not 1600-word coverage.
 */

import { MEAL_SENSE } from "../../../fixtures/meal/knowledge";
import { MEAL_SKELETON_ID } from "../../../fixtures/meal/skeleton";
import { MEAL_SCENE_CLUSTER } from "../../../memory-routing/scene-catalog";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "../../../memory-routing/bundled-lexeme-bindings";
import type {
  ContextualSceneContentPack,
  ContextualSceneLexemeContent,
} from "../../types";
import { MEAL_SCENE_CONTENT_SOURCE_REFS } from "./meal-content-provenance";

export const MEAL_SCENE_CONTENT_PACK_ID = "meal-home-breakfast-v0";
export const HOME_BREAKFAST_FRAME_ID = "home-breakfast-v0";
export const RESTAURANT_MEAL_FRAME_ID = "restaurant-meal-v0";

const HOME_CONTAINS_BOWL_SOUP = "home-fact-contains-bowl-soup";
const HOME_SUITABLE_FOR_SPOON_SOUP = "home-fact-suitable-for-spoon-soup";
const REST_CONTAINS_BOWL_SOUP = "rest-fact-contains-bowl-soup";
const REST_SUITABLE_FOR_SPOON_SOUP = "rest-fact-suitable-for-spoon-soup";

function bundledTarget(key: keyof typeof BUNDLED_LEXEME_BINDINGS) {
  const binding = BUNDLED_LEXEME_BINDINGS[key];
  return {
    lexemeId: bundledBindingLexemeId(binding),
    senseId: MEAL_SENSE[key as keyof typeof MEAL_SENSE].senseId,
    canonicalKey: binding.canonicalKey,
    fixtureSense: MEAL_SENSE[key as keyof typeof MEAL_SENSE],
  };
}

function frameBinding(
  frameId: string,
  entityId: string,
  roleId: string,
  sceneOrder: number,
) {
  return {
    frameId,
    entityId,
    roleId,
    sceneOrder,
  };
}

function containsBowlSoup(frameId: string, bowlId: string, soupId: string, factId: string) {
  return {
    frameId,
    facts: [
      {
        factId,
        predicate: "contains",
        args: [
          { kind: "ENTITY" as const, entityId: bowlId },
          { kind: "ENTITY" as const, entityId: soupId },
        ],
        caption: "碗里装着汤",
      },
    ],
  };
}

function suitableForSpoonSoup(
  frameId: string,
  spoonId: string,
  soupId: string,
  factId: string,
) {
  return {
    frameId,
    facts: [
      {
        factId,
        predicate: "suitable_for",
        args: [
          { kind: "ENTITY" as const, entityId: spoonId },
          { kind: "ENTITY" as const, entityId: soupId },
        ],
        caption: "勺子 → 适合舀汤",
      },
    ],
  };
}

function lexeme(
  id: string,
  key: "soup" | "bowl" | "spoon" | "fork",
  input: Omit<
    ContextualSceneLexemeContent,
    "id" | "target" | "fixtureSense" | "canonicalKey" | "lexicalPresentation"
  > & { displayLabel: string },
): ContextualSceneLexemeContent {
  const identity = bundledTarget(key);
  return {
    id,
    target: { lexemeId: identity.lexemeId, senseId: identity.senseId },
    fixtureSense: identity.fixtureSense,
    canonicalKey: identity.canonicalKey,
    lexicalPresentation: {
      displayFormSource: "BUNDLED_VOCABULARY",
      meaningGlossSource: "BUNDLED_VOCABULARY",
      phoneticSource: "BUNDLED_VOCABULARY",
      displayLabel: input.displayLabel,
    },
    membership: input.membership,
    probe: input.probe,
    grounding: input.grounding,
    contrastBindings: input.contrastBindings,
    build: input.build,
    strengthen: input.strengthen,
  };
}

const soupId = bundledTarget("soup");
const bowlId = bundledTarget("bowl");
const spoonId = bundledTarget("spoon");
const forkId = bundledTarget("fork");

export const MEAL_SCENE_CONTENT_PACK: ContextualSceneContentPack = {
  id: MEAL_SCENE_CONTENT_PACK_ID,
  schemaVersion: "candidate-v0",
  sceneClusterId: MEAL_SCENE_CLUSTER.id,
  skeletonId: MEAL_SKELETON_ID,
  frames: [
    {
      frameId: HOME_BREAKFAST_FRAME_ID,
      title: "早餐时间",
      settingLabel: "看看桌上的食物和餐具。",
      introInstruction: "桌上有汤、碗、勺子和叉子。先看看这些物品。",
      entityIds: ["home-soup", "home-bowl", "home-spoon", "home-fork"],
      factIds: [HOME_CONTAINS_BOWL_SOUP, HOME_SUITABLE_FOR_SPOON_SOUP],
      presentationOrder: ["home-soup", "home-bowl", "home-spoon", "home-fork"],
    },
    {
      frameId: RESTAURANT_MEAL_FRAME_ID,
      title: "餐厅",
      settingLabel: "看看餐厅桌上的食物和餐具。",
      introInstruction: "桌上有汤、碗、勺子和叉子。先看看这些物品。",
      entityIds: ["rest-soup", "rest-bowl", "rest-spoon", "rest-fork"],
      factIds: [REST_CONTAINS_BOWL_SOUP, REST_SUITABLE_FOR_SPOON_SOUP],
      presentationOrder: ["rest-soup", "rest-bowl", "rest-spoon", "rest-fork"],
    },
  ],
  lexemes: [
    lexeme("meal-soup", "soup", {
      displayLabel: "汤",
      membership: {
        frameBindings: [
          frameBinding(HOME_BREAKFAST_FRAME_ID, "home-soup", "FOOD", 0),
          frameBinding(RESTAURANT_MEAL_FRAME_ID, "rest-soup", "FOOD", 0),
        ],
        presentationToken: "soup",
        presentationRole: "FOOD",
      },
      probe: {
        enabled: true,
        skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
        recallInstruction: "写出当前物品的英文单词",
      },
      grounding: {
        frameFacts: [
          containsBowlSoup(HOME_BREAKFAST_FRAME_ID, "home-bowl", "home-soup", HOME_CONTAINS_BOWL_SOUP),
          containsBowlSoup(RESTAURANT_MEAL_FRAME_ID, "rest-bowl", "rest-soup", REST_CONTAINS_BOWL_SOUP),
        ],
      },
      contrastBindings: [
        {
          kind: "ROLE_CONTRAST",
          contrastTarget: { lexemeId: bowlId.lexemeId, senseId: bowlId.senseId },
          instruction: "汤是食物，碗是盛食物的容器。它们不是同一个东西。",
          caption: "汤：碗里的食物",
        },
      ],
      build: {
        enabled: true,
        groundInstruction: "桌上有汤。先看看它在场景里的位置。",
        connectInstruction: "汤是碗里的食物。",
        connectFactByFrame: [
          { frameId: HOME_BREAKFAST_FRAME_ID, factId: HOME_CONTAINS_BOWL_SOUP },
          { frameId: RESTAURANT_MEAL_FRAME_ID, factId: REST_CONTAINS_BOWL_SOUP },
        ],
        teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
        fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
        recallInstructionKey: "Produce the English word for the highlighted food.",
      },
      strengthen: {
        enabled: true,
        reconnectInstruction: "这是强化，不是测试。重新看一看汤和它的英文词形。",
        fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
        verifyInstruction:
          "根据汤的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
      },
    }),
    lexeme("meal-bowl", "bowl", {
      displayLabel: "碗",
      membership: {
        frameBindings: [
          frameBinding(HOME_BREAKFAST_FRAME_ID, "home-bowl", "FOOD_CONTAINER", 1),
          frameBinding(RESTAURANT_MEAL_FRAME_ID, "rest-bowl", "FOOD_CONTAINER", 1),
        ],
        presentationToken: "bowl",
        presentationRole: "CONTAINER",
      },
      probe: {
        enabled: true,
        skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
        recallInstruction: "写出当前物品的英文单词",
      },
      grounding: {
        frameFacts: [
          containsBowlSoup(HOME_BREAKFAST_FRAME_ID, "home-bowl", "home-soup", HOME_CONTAINS_BOWL_SOUP),
          containsBowlSoup(RESTAURANT_MEAL_FRAME_ID, "rest-bowl", "rest-soup", REST_CONTAINS_BOWL_SOUP),
        ],
      },
      contrastBindings: [
        {
          kind: "ROLE_CONTRAST",
          contrastTarget: { lexemeId: soupId.lexemeId, senseId: soupId.senseId },
          instruction: "碗是盛食物的容器，汤是碗里的食物。它们不是同一个东西。",
          caption: "碗：盛汤的容器",
        },
      ],
      build: {
        enabled: true,
        groundInstruction: "桌上有碗。先看看它在场景里的位置。",
        connectInstruction: "碗用来盛汤。",
        connectFactByFrame: [
          { frameId: HOME_BREAKFAST_FRAME_ID, factId: HOME_CONTAINS_BOWL_SOUP },
          { frameId: RESTAURANT_MEAL_FRAME_ID, factId: REST_CONTAINS_BOWL_SOUP },
        ],
        teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
        fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
        recallInstructionKey:
          "Produce the English word for the highlighted container.",
      },
      strengthen: {
        enabled: true,
        reconnectInstruction: "这是强化，不是测试。重新看一看碗和它的英文词形。",
        fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
        verifyInstruction:
          "根据碗的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
      },
    }),
    lexeme("meal-spoon", "spoon", {
      displayLabel: "勺子",
      membership: {
        frameBindings: [
          frameBinding(HOME_BREAKFAST_FRAME_ID, "home-spoon", "EATING_TOOL", 2),
          frameBinding(RESTAURANT_MEAL_FRAME_ID, "rest-spoon", "EATING_TOOL", 2),
        ],
        presentationToken: "spoon",
        presentationRole: "TOOL",
      },
      probe: {
        enabled: true,
        skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
        recallInstruction: "写出当前物品的英文单词",
      },
      grounding: {
        requiredRelationIds: ["SUITABLE_FOR"],
        frameFacts: [
          suitableForSpoonSoup(
            HOME_BREAKFAST_FRAME_ID,
            "home-spoon",
            "home-soup",
            HOME_SUITABLE_FOR_SPOON_SOUP,
          ),
          suitableForSpoonSoup(
            RESTAURANT_MEAL_FRAME_ID,
            "rest-spoon",
            "rest-soup",
            REST_SUITABLE_FOR_SPOON_SOUP,
          ),
        ],
      },
      contrastBindings: [
        {
          kind: "FUNCTION_CONTRAST",
          contrastTarget: { lexemeId: forkId.lexemeId, senseId: forkId.senseId },
          instruction: "比较一下勺子和叉子：它们的用途有什么不同？",
          caption: "勺子：舀取汤或柔软食物",
        },
      ],
      build: {
        enabled: true,
        groundInstruction: "桌上有汤、碗、勺子和叉子。先看看这些物品。",
        connectInstruction: "勺子适合用来喝汤或舀取流质食物。",
        connectFactByFrame: [
          { frameId: HOME_BREAKFAST_FRAME_ID, factId: HOME_SUITABLE_FOR_SPOON_SOUP },
          { frameId: RESTAURANT_MEAL_FRAME_ID, factId: REST_SUITABLE_FOR_SPOON_SOUP },
        ],
        teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
        fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
        recallInstructionKey: "Produce the English word for the required tool.",
      },
      strengthen: {
        enabled: true,
        reconnectInstruction: "这是强化，不是测试。重新看一看勺子和它的英文词形。",
        fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
        verifyInstruction:
          "根据勺子的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
      },
    }),
    lexeme("meal-fork", "fork", {
      displayLabel: "叉子",
      membership: {
        frameBindings: [
          frameBinding(HOME_BREAKFAST_FRAME_ID, "home-fork", "EATING_TOOL", 3),
          frameBinding(RESTAURANT_MEAL_FRAME_ID, "rest-fork", "EATING_TOOL", 3),
        ],
        presentationToken: "fork",
        presentationRole: "TOOL",
      },
      probe: {
        enabled: true,
        skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
        recallInstruction: "写出当前物品的英文单词",
      },
      grounding: {
        frameFacts: [],
      },
      contrastBindings: [
        {
          kind: "FUNCTION_CONTRAST",
          contrastTarget: { lexemeId: spoonId.lexemeId, senseId: spoonId.senseId },
          instruction: "比较一下叉子和勺子：它们的用途有什么不同？",
          caption: "叉子：叉取食物块",
        },
      ],
      build: {
        enabled: true,
        groundInstruction: "桌上有叉子。先看看它在场景里的位置。",
        connectInstruction: "叉子是用来叉取食物的餐具。",
        teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
        fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
        recallInstructionKey:
          "Produce the English word for the highlighted tool.",
      },
      strengthen: {
        enabled: true,
        reconnectInstruction: "这是强化，不是测试。重新看一看叉子和它的英文词形。",
        fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
        verifyInstruction:
          "根据叉子的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
      },
    }),
  ],
  planning: {
    planIdNamespace: "meal",
    activeGoalId: "EATER_CAN_EAT_FOOD",
    sourceLearningNeedRef: "need-opaque-ref",
    guidedRationales: {
      ground:
        "Show the scene and the current entity before any judgment. Acknowledgement is not Evidence.",
      connect:
        "Connect the entity, scene role, and Chinese meaning. Acknowledgement is not independent recall.",
      teach: "Present the English form as teaching support, not as a test.",
      contrast:
        "Show an authored contrast binding. Acknowledgement is not Evidence.",
      fade:
        "Withdraw the full form and leave a spelling cue. Acknowledgement is support exposure, not Evidence.",
      reconnect:
        "Re-show the scene object with the English form. Acknowledgement is support exposure, not Evidence.",
    },
  },
  provenance: {
    status: "APPROVED_FOR_EXPERIMENT",
    sourceRefs: [...MEAL_SCENE_CONTENT_SOURCE_REFS],
    authoredAt: "2026-09-21",
  },
};
