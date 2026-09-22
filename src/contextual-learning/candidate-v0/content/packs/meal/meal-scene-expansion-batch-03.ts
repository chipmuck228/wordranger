/**
 * Meal Scene expansion batch 03.
 * Candidate V0 / CANDIDATE only. Not APPROVED_FOR_EXPERIMENT.
 * Not RELEASE_ELIGIBLE. Not Context Lab runtime. Not /train.
 *
 * Adds knife, bread, and water on top of the fingerprint-bound
 * six-word experiment pack. napkin is BLOCKED (absent from bundled
 * vocabulary) and is not authored.
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
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK } from "./meal-scene-expansion-batch-02";

export const MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID = "meal-scene-expansion-batch-03";

const HOME_SUITABLE_FOR_KNIFE_BREAD = "home-fact-suitable-for-knife-bread";
const REST_SUITABLE_FOR_KNIFE_BREAD = "rest-fact-suitable-for-knife-bread";
const HOME_CONTAINS_VESSEL_WATER = "home-fact-contains-vessel-water";
const REST_CONTAINS_VESSEL_WATER = "rest-fact-contains-vessel-water";

type Batch03Key = "knife" | "bread" | "water" | "fork" | "spoon" | "soup" | "cup";

function bundledTarget(key: Batch03Key) {
  const binding = BUNDLED_LEXEME_BINDINGS[key];
  return {
    lexemeId: bundledBindingLexemeId(binding),
    senseId: MEAL_SENSE[key].senseId,
    canonicalKey: binding.canonicalKey,
    fixtureSense: MEAL_SENSE[key],
  };
}

export const MEAL_SCENE_EXPANSION_BATCH_03_KNIFE_TARGET = {
  lexemeId: bundledTarget("knife").lexemeId,
  senseId: bundledTarget("knife").senseId,
};

export const MEAL_SCENE_EXPANSION_BATCH_03_BREAD_TARGET = {
  lexemeId: bundledTarget("bread").lexemeId,
  senseId: bundledTarget("bread").senseId,
};

export const MEAL_SCENE_EXPANSION_BATCH_03_WATER_TARGET = {
  lexemeId: bundledTarget("water").lexemeId,
  senseId: bundledTarget("water").senseId,
};

function suitableForKnifeBread(
  frameId: string,
  knifeId: string,
  breadId: string,
  factId: string,
) {
  return {
    frameId,
    facts: [
      {
        factId,
        predicate: "suitable_for",
        args: [
          { kind: "ENTITY" as const, entityId: knifeId },
          { kind: "ENTITY" as const, entityId: breadId },
        ],
        caption: "这把小刀适合切开面包",
      },
    ],
  };
}

function containsVesselWater(
  frameId: string,
  vesselId: string,
  waterId: string,
  factId: string,
) {
  return {
    frameId,
    facts: [
      {
        factId,
        predicate: "contains",
        args: [
          { kind: "ENTITY" as const, entityId: vesselId },
          { kind: "ENTITY" as const, entityId: waterId },
        ],
        caption: "容器里装着水",
      },
    ],
  };
}

function knifeLexeme(): ContextualSceneLexemeContent {
  const knife = bundledTarget("knife");
  const fork = bundledTarget("fork");
  return {
    id: "meal-knife",
    target: { lexemeId: knife.lexemeId, senseId: knife.senseId },
    fixtureSense: knife.fixtureSense,
    canonicalKey: knife.canonicalKey,
    lexicalPresentation: {
      displayFormSource: "BUNDLED_VOCABULARY",
      meaningGlossSource: "BUNDLED_VOCABULARY",
      phoneticSource: "BUNDLED_VOCABULARY",
      displayLabel: "小刀",
      meaningGlossSelector: { kind: "EXACT_BUNDLED_VALUE", value: "小刀" },
    },
    membership: {
      frameBindings: [
        {
          frameId: HOME_BREAKFAST_FRAME_ID,
          entityId: "home-knife",
          roleId: "EATING_TOOL",
          sceneOrder: 6,
        },
        {
          frameId: RESTAURANT_MEAL_FRAME_ID,
          entityId: "rest-knife",
          roleId: "EATING_TOOL",
          sceneOrder: 6,
        },
      ],
      presentationToken: "knife",
      presentationRole: "TOOL",
    },
    probe: {
      enabled: true,
      skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
      recallInstruction: "写出当前物品的英文单词",
    },
    grounding: {
      requiredRelationIds: ["SUITABLE_FOR_CUTTING"],
      frameFacts: [
        suitableForKnifeBread(
          HOME_BREAKFAST_FRAME_ID,
          "home-knife",
          "home-bread",
          HOME_SUITABLE_FOR_KNIFE_BREAD,
        ),
        suitableForKnifeBread(
          RESTAURANT_MEAL_FRAME_ID,
          "rest-knife",
          "rest-bread",
          REST_SUITABLE_FOR_KNIFE_BREAD,
        ),
      ],
    },
    contrastBindings: [
      {
        kind: "FUNCTION_CONTRAST",
        contrastTarget: { lexemeId: fork.lexemeId, senseId: fork.senseId },
        instruction: "比较一下这把小刀和叉子：它们切开食物和叉起食物的方式有什么不同？",
        caption: "小刀：切开固体食物",
      },
    ],
    build: {
      enabled: true,
      groundInstruction: "桌上有一把较小的餐具。先看看它在场景里的位置。",
      connectInstruction: "这件餐具适合切开固体食物。",
      connectFactByFrame: [
        { frameId: HOME_BREAKFAST_FRAME_ID, factId: HOME_SUITABLE_FOR_KNIFE_BREAD },
        { frameId: RESTAURANT_MEAL_FRAME_ID, factId: REST_SUITABLE_FOR_KNIFE_BREAD },
      ],
      teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      recallInstructionKey: "Produce the English word for the highlighted cutting tool.",
    },
    strengthen: {
      enabled: true,
      reconnectInstruction: "这是强化，不是测试。重新看一看这件切开食物的餐具和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      verifyInstruction: "根据这件切开食物的餐具的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
    },
  };
}

function breadLexeme(): ContextualSceneLexemeContent {
  const bread = bundledTarget("bread");
  const soup = bundledTarget("soup");
  return {
    id: "meal-bread",
    target: { lexemeId: bread.lexemeId, senseId: bread.senseId },
    fixtureSense: bread.fixtureSense,
    canonicalKey: bread.canonicalKey,
    lexicalPresentation: {
      displayFormSource: "BUNDLED_VOCABULARY",
      meaningGlossSource: "BUNDLED_VOCABULARY",
      phoneticSource: "BUNDLED_VOCABULARY",
      displayLabel: "面包",
      meaningGlossSelector: { kind: "EXACT_BUNDLED_VALUE", value: "面包" },
    },
    membership: {
      frameBindings: [
        {
          frameId: HOME_BREAKFAST_FRAME_ID,
          entityId: "home-bread",
          roleId: "SOLID_FOOD",
          sceneOrder: 7,
        },
        {
          frameId: RESTAURANT_MEAL_FRAME_ID,
          entityId: "rest-bread",
          roleId: "SOLID_FOOD",
          sceneOrder: 7,
        },
      ],
      presentationToken: "bread",
      presentationRole: "FOOD",
    },
    probe: {
      enabled: true,
      skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
      recallInstruction: "写出当前物品的英文单词",
    },
    grounding: {
      requiredRelationIds: ["SUITABLE_FOR_CUTTING"],
      frameFacts: [
        suitableForKnifeBread(
          HOME_BREAKFAST_FRAME_ID,
          "home-knife",
          "home-bread",
          HOME_SUITABLE_FOR_KNIFE_BREAD,
        ),
        suitableForKnifeBread(
          RESTAURANT_MEAL_FRAME_ID,
          "rest-knife",
          "rest-bread",
          REST_SUITABLE_FOR_KNIFE_BREAD,
        ),
      ],
    },
    contrastBindings: [
      {
        kind: "FORM_CONTRAST",
        contrastTarget: { lexemeId: soup.lexemeId, senseId: soup.senseId },
        instruction: "比较一下这种固体食物和碗里的汤：一个可以切开，一个是液体。",
        caption: "面包：可以切开的固体食物",
      },
    ],
    build: {
      enabled: true,
      groundInstruction: "桌上有一块固体食物。先看看它在场景里的位置。",
      connectInstruction: "这件食物可以用小刀切开。",
      connectFactByFrame: [
        { frameId: HOME_BREAKFAST_FRAME_ID, factId: HOME_SUITABLE_FOR_KNIFE_BREAD },
        { frameId: RESTAURANT_MEAL_FRAME_ID, factId: REST_SUITABLE_FOR_KNIFE_BREAD },
      ],
      teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      recallInstructionKey: "Produce the English word for the highlighted solid food.",
    },
    strengthen: {
      enabled: true,
      reconnectInstruction: "这是强化，不是测试。重新看一看这块固体食物和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      verifyInstruction: "根据这块固体食物的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
    },
  };
}

function waterLexeme(): ContextualSceneLexemeContent {
  const water = bundledTarget("water");
  const soup = bundledTarget("soup");
  return {
    id: "meal-water",
    target: { lexemeId: water.lexemeId, senseId: water.senseId },
    fixtureSense: water.fixtureSense,
    canonicalKey: water.canonicalKey,
    lexicalPresentation: {
      displayFormSource: "BUNDLED_VOCABULARY",
      meaningGlossSource: "BUNDLED_VOCABULARY",
      phoneticSource: "BUNDLED_VOCABULARY",
      displayLabel: "水",
      meaningGlossSelector: { kind: "EXACT_BUNDLED_VALUE", value: "水" },
    },
    membership: {
      frameBindings: [
        {
          frameId: HOME_BREAKFAST_FRAME_ID,
          entityId: "home-water",
          roleId: "DRINKABLE_LIQUID",
          sceneOrder: 8,
        },
        {
          frameId: RESTAURANT_MEAL_FRAME_ID,
          entityId: "rest-water",
          roleId: "DRINKABLE_LIQUID",
          sceneOrder: 8,
        },
      ],
      presentationToken: "water",
      presentationRole: "DRINK",
    },
    probe: {
      enabled: true,
      skills: ["ACTIVE_RECALL", "MEANING_RECOGNITION"],
      recallInstruction: "写出当前物品的英文单词",
    },
    grounding: {
      requiredRelationIds: ["CONTAINS_DRINKABLE"],
      frameFacts: [
        containsVesselWater(
          HOME_BREAKFAST_FRAME_ID,
          "home-water-vessel",
          "home-water",
          HOME_CONTAINS_VESSEL_WATER,
        ),
        containsVesselWater(
          RESTAURANT_MEAL_FRAME_ID,
          "rest-water-vessel",
          "rest-water",
          REST_CONTAINS_VESSEL_WATER,
        ),
      ],
    },
    contrastBindings: [
      {
        kind: "MEANING_CONTRAST",
        contrastTarget: { lexemeId: soup.lexemeId, senseId: soup.senseId },
        instruction: "比较一下这种可以喝的液体和碗里的汤：一个是饮用的，一个是食物。",
        caption: "水：用来喝的液体",
      },
    ],
    build: {
      enabled: true,
      groundInstruction: "桌上有一份可以喝的液体。先看看它在场景里的位置。",
      connectInstruction: "这份液体装在旁边的容器里，用来喝。",
      connectFactByFrame: [
        { frameId: HOME_BREAKFAST_FRAME_ID, factId: HOME_CONTAINS_VESSEL_WATER },
        { frameId: RESTAURANT_MEAL_FRAME_ID, factId: REST_CONTAINS_VESSEL_WATER },
      ],
      teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      recallInstructionKey: "Produce the English word for the highlighted drinkable liquid.",
    },
    strengthen: {
      enabled: true,
      reconnectInstruction: "这是强化，不是测试。重新看一看这份可喝的液体和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      verifyInstruction: "根据这份可喝液体的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
    },
  };
}

function attachBatch03(pack: ContextualSceneContentPack): ContextualSceneContentPack {
  const next = structuredClone(pack);
  next.id = MEAL_SCENE_EXPANSION_BATCH_03_PACK_ID;
  next.provenance = {
    status: "CANDIDATE",
    sourceRefs: [
      ...MEAL_SCENE_CONTENT_SOURCE_REFS,
      "docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_01_CANDIDATE.md",
      "docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_02_CANDIDATE.md",
      "docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_03_CANDIDATE.md",
    ],
    authoredAt: "2026-09-22",
  };
  const additions = [
    knifeLexeme(),
    breadLexeme(),
    waterLexeme(),
  ];
  for (const frame of next.frames) {
    const prefix = frame.frameId === RESTAURANT_MEAL_FRAME_ID ? "rest" : "home";
    const extras = [
      `${prefix}-knife`,
      `${prefix}-bread`,
      `${prefix}-water`,
      `${prefix}-water-vessel`,
    ];
    const facts =
      prefix === "rest"
        ? [REST_SUITABLE_FOR_KNIFE_BREAD, REST_CONTAINS_VESSEL_WATER]
        : [HOME_SUITABLE_FOR_KNIFE_BREAD, HOME_CONTAINS_VESSEL_WATER];
    for (const entityId of extras) {
      if (!frame.entityIds.includes(entityId)) {
        frame.entityIds.push(entityId);
      }
      if (!frame.presentationOrder.includes(entityId)) {
        frame.presentationOrder.push(entityId);
      }
    }
    for (const factId of facts) {
      if (!frame.factIds.includes(factId)) {
        frame.factIds.push(factId);
      }
    }
    frame.introInstruction =
      "桌上有汤、碗、勺子、叉子、盛饮料的容器、盘子、小刀、面包和水。先看看这些物品。";
  }
  next.lexemes.push(...additions);
  return next;
}

export const MEAL_SCENE_EXPANSION_BATCH_03_PACK = attachBatch03(
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
);
