/**
 * Meal Scene expansion batch 02.
 * Candidate V0 / CANDIDATE only. Not approved. Not experiment runtime.
 *
 * Adds plate on top of the fingerprint-bound five-word experiment pack.
 * Not Standard. Not production /train.
 */

import { MEAL_SENSE } from "../../../fixtures/meal/knowledge";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "../../../memory-routing/bundled-lexeme-bindings";
import type {
  ContextualSceneContentPack,
  ContextualSceneLexemeContent,
} from "../../types";
import { MEAL_SCENE_CONTENT_SOURCE_REFS } from "./meal-content-provenance";
import {
  HOME_BREAKFAST_FRAME_ID,
  RESTAURANT_MEAL_FRAME_ID,
} from "./meal-scene-content";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK } from "./meal-scene-expansion-batch-01";

export const MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID = "meal-scene-expansion-batch-02";

const HOME_SUPPORTS_PLATE_FOOD = "home-fact-supports-plate-food";
const REST_SUPPORTS_PLATE_FOOD = "rest-fact-supports-plate-food";

function bundledTarget(key: "plate" | "bowl") {
  const binding = BUNDLED_LEXEME_BINDINGS[key];
  return {
    lexemeId: bundledBindingLexemeId(binding),
    senseId: MEAL_SENSE[key].senseId,
    canonicalKey: binding.canonicalKey,
    fixtureSense: MEAL_SENSE[key],
  };
}

export const MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET = {
  lexemeId: bundledTarget("plate").lexemeId,
  senseId: bundledTarget("plate").senseId,
};

function supportsPlateFood(
  frameId: string,
  plateId: string,
  foodId: string,
  factId: string,
) {
  return {
    frameId,
    facts: [
      {
        factId,
        predicate: "supports",
        args: [
          { kind: "ENTITY" as const, entityId: plateId },
          { kind: "ENTITY" as const, entityId: foodId },
        ],
        caption: "盘子上放着食物",
      },
    ],
  };
}

function plateLexeme(): ContextualSceneLexemeContent {
  const plate = bundledTarget("plate");
  const bowl = bundledTarget("bowl");
  return {
    id: "meal-plate",
    target: { lexemeId: plate.lexemeId, senseId: plate.senseId },
    fixtureSense: plate.fixtureSense,
    canonicalKey: plate.canonicalKey,
    lexicalPresentation: {
      displayFormSource: "BUNDLED_VOCABULARY",
      meaningGlossSource: "BUNDLED_VOCABULARY",
      phoneticSource: "BUNDLED_VOCABULARY",
      displayLabel: "盘子",
      meaningGlossSelector: {
        kind: "EXACT_BUNDLED_VALUE",
        value: "盘子",
      },
    },
    membership: {
      frameBindings: [
        {
          frameId: HOME_BREAKFAST_FRAME_ID,
          entityId: "home-plate",
          roleId: "FOOD_SUPPORT",
          sceneOrder: 5,
        },
        {
          frameId: RESTAURANT_MEAL_FRAME_ID,
          entityId: "rest-plate",
          roleId: "FOOD_SUPPORT",
          sceneOrder: 5,
        },
      ],
      presentationToken: "plate",
      presentationRole: "SUPPORT",
    },
    probe: {
      enabled: true,
      skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
      recallInstruction: "写出当前物品的英文单词",
    },
    grounding: {
      requiredRelationIds: ["SUPPORTS_FOOD"],
      frameFacts: [
        supportsPlateFood(
          HOME_BREAKFAST_FRAME_ID,
          "home-plate",
          "home-served-food",
          HOME_SUPPORTS_PLATE_FOOD,
        ),
        supportsPlateFood(
          RESTAURANT_MEAL_FRAME_ID,
          "rest-plate",
          "rest-served-food",
          REST_SUPPORTS_PLATE_FOOD,
        ),
      ],
    },
    contrastBindings: [
      {
        kind: "ROLE_CONTRAST",
        contrastTarget: { lexemeId: bowl.lexemeId, senseId: bowl.senseId },
        instruction: "这个较平的盘子用来放食物，不是那个较深、装着汤的碗。",
        caption: "盘子：放食物的平底餐具",
      },
    ],
    build: {
      enabled: true,
      groundInstruction: "桌上有一个较平的盘子。先看看它在场景里的位置。",
      connectInstruction: "这个盘子用来放食物。",
      connectFactByFrame: [
        { frameId: HOME_BREAKFAST_FRAME_ID, factId: HOME_SUPPORTS_PLATE_FOOD },
        { frameId: RESTAURANT_MEAL_FRAME_ID, factId: REST_SUPPORTS_PLATE_FOOD },
      ],
      teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      recallInstructionKey: "Produce the English word for the highlighted food support.",
    },
    strengthen: {
      enabled: true,
      reconnectInstruction: "这是强化，不是测试。重新看一看这个放食物的盘子和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      verifyInstruction:
        "根据这个放食物的盘子的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
    },
  };
}

function attachPlate(pack: ContextualSceneContentPack): ContextualSceneContentPack {
  const next = structuredClone(pack);
  next.id = MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID;
  next.provenance = {
    status: "CANDIDATE",
    sourceRefs: [
      ...MEAL_SCENE_CONTENT_SOURCE_REFS,
      "docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_01_CANDIDATE.md",
      "docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_02_CANDIDATE.md",
    ],
    authoredAt: "2026-09-21",
  };
  for (const frame of next.frames) {
    const prefix = frame.frameId === RESTAURANT_MEAL_FRAME_ID ? "rest" : "home";
    const plateId = `${prefix}-plate`;
    const foodId = `${prefix}-served-food`;
    const factId =
      prefix === "rest" ? REST_SUPPORTS_PLATE_FOOD : HOME_SUPPORTS_PLATE_FOOD;
    if (!frame.entityIds.includes(plateId)) {
      frame.entityIds.push(plateId);
    }
    if (!frame.entityIds.includes(foodId)) {
      frame.entityIds.push(foodId);
    }
    if (!frame.factIds.includes(factId)) {
      frame.factIds.push(factId);
    }
    if (!frame.presentationOrder.includes(plateId)) {
      frame.presentationOrder.push(plateId);
    }
    frame.introInstruction =
      "桌上有汤、碗、勺子、叉子、盛饮料的容器和盘子。先看看这些物品。";
  }
  next.lexemes.push(plateLexeme());
  return next;
}

export const MEAL_SCENE_EXPANSION_BATCH_02_PACK = attachPlate(
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
);
