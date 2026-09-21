/**
 * Data-only extensibility test.
 * This is not a fifth production Meal word.
 */

import { describe, expect, it } from "vitest";
import { homeBreakfastFrame } from "@/contextual-learning/candidate-v0/fixtures/meal/contexts";
import { mealSkeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/skeleton";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import { MEAL_SENSE } from "@/contextual-learning/candidate-v0/fixtures/meal/knowledge";
import type { ContextFrame } from "@/contextual-learning/candidate-v0/domain/types";
import { validateSceneContent } from "@/contextual-learning/candidate-v0/content/validate-scene-content";
import { resolveSceneContent } from "@/contextual-learning/candidate-v0/content/resolve-scene-content";
import {
  projectProbeTargets,
  projectQueueCatalog,
} from "@/contextual-learning/candidate-v0/content/project-from-resolved";
import { projectPublicScenePresentation } from "@/contextual-learning/candidate-v0/content/project-public-presentation";
import {
  createContextualLexicalBuildPlan,
  createContextualLexicalStrengthenPlan,
} from "@/contextual-learning/candidate-v0/planning/create-contextual-lexical-plans";
import { listSceneContentRegistry } from "@/contextual-learning/candidate-v0/content/scene-content-registry";
import { cloneMealPack, mealTestLexemeLoader } from "./helpers";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";

const SYNTHETIC_TARGET = {
  lexemeId: "test-lex-cloth",
  senseId: "test-cloth#wiping",
};

const SYNTHETIC_LOADER = (canonicalKey: string) => {
  if (canonicalKey === "test-cloth-key") {
    return {
      id: SYNTHETIC_TARGET.lexemeId,
      display: "cloth",
      lemma: "cloth",
      meaningsZh: ["布"],
      ipa: [],
    };
  }
  return mealTestLexemeLoader(canonicalKey);
};

function syntheticFrame(): ContextFrame {
  return {
    ...homeBreakfastFrame,
    id: "synthetic-meal-extension-v0",
    entityBindings: [
      ...homeBreakfastFrame.entityBindings,
      {
        entityId: "home-cloth",
        roleId: "EATING_TOOL",
        label: "Test cloth",
        conceptIds: [],
        lexemeSenseBindings: [
          { sense: SYNTHETIC_TARGET, bindingKind: "NAMES_ENTITY" },
        ],
      },
    ],
  };
}

function syntheticPack(): ContextualSceneContentPack {
  const pack = cloneMealPack();
  const fork = pack.lexemes.find((item) => item.id === "meal-fork")!;
  pack.id = "synthetic-meal-extension";
  pack.provenance = { ...pack.provenance, status: "CANDIDATE" };
  pack.frames = [
    {
      ...pack.frames[0]!,
      frameId: "synthetic-meal-extension-v0",
      entityIds: [...pack.frames[0]!.entityIds, "home-cloth"],
      presentationOrder: [...pack.frames[0]!.presentationOrder, "home-cloth"],
    },
  ];
  for (const lexeme of pack.lexemes) {
    lexeme.membership = {
      ...lexeme.membership,
      frameBindings: lexeme.membership.frameBindings
        .filter((binding) => binding.frameId === "home-breakfast-v0")
        .map((binding) => ({
          ...binding,
          frameId: "synthetic-meal-extension-v0",
        })),
    };
    lexeme.grounding = {
      ...lexeme.grounding,
      frameFacts: lexeme.grounding.frameFacts
        .filter((group) => group.frameId === "home-breakfast-v0")
        .map((group) => ({
          ...group,
          frameId: "synthetic-meal-extension-v0",
        })),
    };
    if (lexeme.build.connectFactByFrame) {
      lexeme.build = {
        ...lexeme.build,
        connectFactByFrame: lexeme.build.connectFactByFrame
          .filter((item) => item.frameId === "home-breakfast-v0")
          .map((item) => ({
            ...item,
            frameId: "synthetic-meal-extension-v0",
          })),
      };
    }
  }
  pack.lexemes.push({
    id: "synthetic-cloth",
    target: SYNTHETIC_TARGET,
    fixtureSense: SYNTHETIC_TARGET,
    canonicalKey: "test-cloth-key",
    membership: {
      frameBindings: [
        {
          frameId: "synthetic-meal-extension-v0",
          entityId: "home-cloth",
          roleId: "EATING_TOOL",
          sceneOrder: 4,
        },
      ],
      presentationToken: "cloth",
      presentationRole: "TOOL",
    },
    probe: {
      enabled: true,
      skills: ["ACTIVE_RECALL"],
      recallInstruction: "写出当前物品的英文单词",
    },
    lexicalPresentation: {
      displayFormSource: "BUNDLED_VOCABULARY",
      meaningGlossSource: "BUNDLED_VOCABULARY",
      phoneticSource: "BUNDLED_VOCABULARY",
      displayLabel: "布",
    },
    grounding: {
      frameFacts: [],
    },
    contrastBindings: [
      {
        kind: "FUNCTION_CONTRAST",
        contrastTarget: { ...fork.target },
        instruction: "布和叉子用途不同。",
        caption: "布：擦拭",
      },
    ],
    build: {
      enabled: true,
      groundInstruction: "桌上还有一块布。",
      connectInstruction: "布用来擦拭，不是餐具。",
      teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      recallInstructionKey: "Produce the English word for the highlighted wiping object.",
    },
    strengthen: {
      enabled: true,
      reconnectInstruction: "重新看一看布和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      verifyInstruction: "根据意思写出英文单词。",
    },
  });
  return pack;
}

describe("synthetic Meal extension is data-only", () => {
  it("validates, resolves, and projects a fifth target without a runtime switch", () => {
    const pack = syntheticPack();
    const frame = syntheticFrame();
    const validated = validateSceneContent({
      pack,
      frame,
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: SYNTHETIC_LOADER,
    });
    expect(validated).toEqual({ ok: true });

    const resolved = resolveSceneContent({
      pack,
      frame,
      skeleton: mealSkeleton,
      cluster: MEAL_SCENE_CLUSTER,
      loadLexeme: SYNTHETIC_LOADER,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }
    expect(resolved.content.lexemes).toHaveLength(5);
    expect(projectProbeTargets(resolved.content).map((item) => item.entityId)).toContain(
      "home-cloth",
    );
    expect(projectQueueCatalog(resolved.content)).toHaveLength(5);

    const build = createContextualLexicalBuildPlan({
      frame,
      content: resolved.content,
      target: SYNTHETIC_TARGET,
      stepIdPrefix: "home",
    });
    expect(build.steps).toHaveLength(6);
    expect(build.id).toContain("cloth");

    const strengthen = createContextualLexicalStrengthenPlan({
      frame,
      content: resolved.content,
      target: SYNTHETIC_TARGET,
      stepIdPrefix: "home",
    });
    expect(strengthen.steps).toHaveLength(3);

    const presented = projectPublicScenePresentation({
      stage: "BUILD_TEACH",
      lexeme: resolved.content.lexemes[4]!,
    });
    expect(presented.displayForm).toBe("cloth");
    expect(listSceneContentRegistry().some((entry) => entry.packId === pack.id)).toBe(
      false,
    );
    expect(MEAL_SENSE).not.toHaveProperty("cloth");
  });
});
