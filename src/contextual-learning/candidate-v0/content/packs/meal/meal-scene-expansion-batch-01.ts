/**
 * Meal Scene expansion batch 01.
 * Candidate V0 / APPROVED_FOR_EXPERIMENT only after fingerprint-bound
 * human review. Not Standard. Not production /train.
 *
 * Adds the first catalog-mapped Meal word that already has honest
 * entity/fact grounding: cup. Not 1600-word coverage.
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
  MEAL_SCENE_CONTENT_PACK,
  RESTAURANT_MEAL_FRAME_ID,
} from "./meal-scene-content";

export const MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID = "meal-scene-expansion-batch-01";

const HOME_CONTAINS_CUP_DRINK = "home-fact-contains-cup-drink";
const REST_CONTAINS_CUP_DRINK = "rest-fact-contains-cup-drink";

function bundledTarget(key: "cup" | "bowl") {
  const binding = BUNDLED_LEXEME_BINDINGS[key];
  return {
    lexemeId: bundledBindingLexemeId(binding),
    senseId: MEAL_SENSE[key].senseId,
    canonicalKey: binding.canonicalKey,
    fixtureSense: MEAL_SENSE[key],
  };
}

export const MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET = {
  lexemeId: bundledTarget("cup").lexemeId,
  senseId: bundledTarget("cup").senseId,
};

function containsCupDrink(
  frameId: string,
  cupId: string,
  drinkId: string,
  factId: string,
) {
  return {
    frameId,
    facts: [
      {
        factId,
        predicate: "contains",
        args: [
          { kind: "ENTITY" as const, entityId: cupId },
          { kind: "ENTITY" as const, entityId: drinkId },
        ],
        caption: "杯子里装着饮料",
      },
    ],
  };
}

function cupLexeme(): ContextualSceneLexemeContent {
  const cup = bundledTarget("cup");
  const bowl = bundledTarget("bowl");
  return {
    id: "meal-cup",
    target: { lexemeId: cup.lexemeId, senseId: cup.senseId },
    fixtureSense: cup.fixtureSense,
    canonicalKey: cup.canonicalKey,
    lexicalPresentation: {
      displayFormSource: "BUNDLED_VOCABULARY",
      meaningGlossSource: "BUNDLED_VOCABULARY",
      phoneticSource: "BUNDLED_VOCABULARY",
      displayLabel: "杯子",
    },
    membership: {
      frameBindings: [
        {
          frameId: HOME_BREAKFAST_FRAME_ID,
          entityId: "home-cup",
          roleId: "DRINK_CONTAINER",
          sceneOrder: 4,
        },
        {
          frameId: RESTAURANT_MEAL_FRAME_ID,
          entityId: "rest-cup",
          roleId: "DRINK_CONTAINER",
          sceneOrder: 4,
        },
      ],
      presentationToken: "cup",
      presentationRole: "CONTAINER",
    },
    probe: {
      enabled: true,
      skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
      recallInstruction: "写出当前物品的英文单词",
    },
    grounding: {
      requiredRelationIds: ["CONTAINS_DRINK"],
      frameFacts: [
        containsCupDrink(
          HOME_BREAKFAST_FRAME_ID,
          "home-cup",
          "home-drink",
          HOME_CONTAINS_CUP_DRINK,
        ),
        containsCupDrink(
          RESTAURANT_MEAL_FRAME_ID,
          "rest-cup",
          "rest-drink",
          REST_CONTAINS_CUP_DRINK,
        ),
      ],
    },
    contrastBindings: [
      {
        kind: "ROLE_CONTRAST",
        contrastTarget: { lexemeId: bowl.lexemeId, senseId: bowl.senseId },
        instruction: "盛饮料的容器和盛食物的碗不是同一个东西。",
        caption: "杯子：盛饮料的容器",
      },
    ],
    build: {
      enabled: true,
      groundInstruction: "桌上有盛饮料的容器。先看看它在场景里的位置。",
      connectInstruction: "这个容器用来盛饮料。",
      connectFactByFrame: [
        { frameId: HOME_BREAKFAST_FRAME_ID, factId: HOME_CONTAINS_CUP_DRINK },
        { frameId: RESTAURANT_MEAL_FRAME_ID, factId: REST_CONTAINS_CUP_DRINK },
      ],
      teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      recallInstructionKey: "Produce the English word for the highlighted drink container.",
    },
    strengthen: {
      enabled: true,
      reconnectInstruction: "这是强化，不是测试。重新看一看这个盛饮料容器和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      verifyInstruction:
        "根据这个盛饮料容器的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
    },
  };
}

function attachCup(pack: ContextualSceneContentPack): ContextualSceneContentPack {
  const next = structuredClone(pack);
  next.id = MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID;
  next.provenance = {
    status: "APPROVED_FOR_EXPERIMENT",
    sourceRefs: [
      ...MEAL_SCENE_CONTENT_SOURCE_REFS,
      "docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_01_CANDIDATE.md",
    ],
    authoredAt: "2026-09-21",
  };
  for (const frame of next.frames) {
    const prefix = frame.frameId === RESTAURANT_MEAL_FRAME_ID ? "rest" : "home";
    const cupId = `${prefix}-cup`;
    const drinkId = `${prefix}-drink`;
    const factId =
      prefix === "rest" ? REST_CONTAINS_CUP_DRINK : HOME_CONTAINS_CUP_DRINK;
    if (!frame.entityIds.includes(cupId)) {
      frame.entityIds.push(cupId);
    }
    if (!frame.entityIds.includes(drinkId)) {
      frame.entityIds.push(drinkId);
    }
    if (!frame.factIds.includes(factId)) {
      frame.factIds.push(factId);
    }
    if (!frame.presentationOrder.includes(cupId)) {
      frame.presentationOrder.push(cupId);
    }
    frame.introInstruction =
      "桌上有汤、碗、勺子、叉子和盛饮料的容器。先看看这些物品。";
  }
  next.lexemes.push(cupLexeme());
  return next;
}

export const MEAL_SCENE_EXPANSION_BATCH_01_PACK = attachCup(MEAL_SCENE_CONTENT_PACK);
