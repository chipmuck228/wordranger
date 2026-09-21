import { describe, expect, it } from "vitest";
import { createContextualLexicalBuildPlan } from "@/contextual-learning/candidate-v0/planning/create-contextual-lexical-plans";
import { resolveSceneContent } from "@/contextual-learning/candidate-v0/content/resolve-scene-content";
import { curatedFixtureProvenance } from "@/contextual-learning/candidate-v0/domain/provenance";
import type {
  ContextFrame,
  SemanticSkeleton,
} from "@/contextual-learning/candidate-v0/domain/types";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import type { SceneVocabularyCluster } from "@/contextual-learning/candidate-v0/memory-routing/types";

const TARGET = { lexemeId: "test-lex-pen", senseId: "test-pen#writing" };

const skeleton: SemanticSkeleton = {
  id: "desk-setting-v0",
  version: 0,
  title: "Desk setting",
  description: "A non-Meal skeleton for Scene Content factory proof.",
  supportedContextKinds: ["PHYSICAL"],
  roleDefinitions: [{ id: "OBJECT", label: "Object", cardinality: "ONE", accepts: [] }],
  relationDefinitions: [],
  goalDefinitions: [
    {
      id: "NAME_THE_OBJECT",
      description: "Name the object",
      successPredicate: { predicate: "named", arguments: [], expected: true },
    },
  ],
  validationRules: [],
  provenance: curatedFixtureProvenance("tests/generic-factory-non-meal"),
  reviewStatus: "REVIEWED",
};

const frame: ContextFrame = {
  id: "desk-v0",
  skeletonId: skeleton.id,
  title: "Desk",
  kinds: ["PHYSICAL"],
  locale: "en",
  entityBindings: [
    {
      entityId: "desk-pen",
      roleId: "OBJECT",
      label: "Pen",
      conceptIds: [],
      lexemeSenseBindings: [{ sense: TARGET, bindingKind: "NAMES_ENTITY" }],
    },
    {
      entityId: "desk-paper",
      roleId: "OBJECT",
      label: "Paper",
      conceptIds: [],
      lexemeSenseBindings: [
        { sense: { lexemeId: "test-lex-paper", senseId: "test-paper#sheet" }, bindingKind: "NAMES_ENTITY" },
      ],
    },
  ],
  initialFacts: [],
  goalBindings: [{ goalId: "NAME_THE_OBJECT", active: true }],
  allowedSemanticActions: ["OBSERVE", "TYPE"],
  contentTags: ["desk"],
  provenance: curatedFixtureProvenance("tests/generic-factory-non-meal"),
  reviewStatus: "REVIEWED",
};

const cluster: SceneVocabularyCluster = {
  id: "desk-scene-v0",
  version: "candidate-v0",
  title: "Desk",
  semanticScope: "desk objects",
  allowedRoleIds: ["OBJECT"],
  members: [],
};

const pack: ContextualSceneContentPack = {
  id: "desk-scene-v0",
  schemaVersion: "candidate-v0",
  sceneClusterId: cluster.id,
  skeletonId: skeleton.id,
  frames: [
    {
      frameId: frame.id,
      title: "书桌",
      settingLabel: "看看桌上的物品。",
      entityIds: ["desk-pen", "desk-paper"],
      factIds: [],
      presentationOrder: ["desk-pen", "desk-paper"],
    },
  ],
  lexemes: [
    {
      id: "desk-pen",
      target: TARGET,
      fixtureSense: TARGET,
      canonicalKey: "test-pen-key",
      membership: {
        frameBindings: [
          { frameId: frame.id, entityId: "desk-pen", roleId: "OBJECT", sceneOrder: 0 },
        ],
        presentationToken: "pen",
        presentationRole: "OBJECT",
      },
      probe: { enabled: true, skills: ["ACTIVE_RECALL"], recallInstruction: "写出当前物品" },
      lexicalPresentation: {
        displayFormSource: "BUNDLED_VOCABULARY",
        meaningGlossSource: "BUNDLED_VOCABULARY",
        phoneticSource: "BUNDLED_VOCABULARY",
        displayLabel: "笔",
      },
      grounding: { frameFacts: [] },
      contrastBindings: [
        {
          kind: "FUNCTION_CONTRAST",
          contrastTarget: { lexemeId: "test-lex-paper", senseId: "test-paper#sheet" },
          instruction: "笔和纸用途不同。",
        },
      ],
      build: {
        enabled: true,
        groundInstruction: "桌上有一支笔。",
        connectInstruction: "笔用来写字。",
        teachInstruction: "看一看这个词。",
        fadeInstruction: "完整英文已经收起。",
        recallInstructionKey: "Produce the English word for the highlighted object.",
      },
      strengthen: {
        enabled: true,
        reconnectInstruction: "重新看一看这个词。",
        fadeInstruction: "完整英文已经收起。",
        verifyInstruction: "根据意思写出英文单词。",
      },
    },
    {
      id: "desk-paper",
      target: { lexemeId: "test-lex-paper", senseId: "test-paper#sheet" },
      fixtureSense: { lexemeId: "test-lex-paper", senseId: "test-paper#sheet" },
      canonicalKey: "test-paper-key",
      membership: {
        frameBindings: [
          { frameId: frame.id, entityId: "desk-paper", roleId: "OBJECT", sceneOrder: 1 },
        ],
        presentationToken: "paper",
        presentationRole: "OBJECT",
      },
      probe: { enabled: true, skills: ["ACTIVE_RECALL"], recallInstruction: "写出当前物品" },
      lexicalPresentation: {
        displayFormSource: "BUNDLED_VOCABULARY",
        meaningGlossSource: "BUNDLED_VOCABULARY",
        phoneticSource: "BUNDLED_VOCABULARY",
        displayLabel: "纸",
      },
      grounding: { frameFacts: [] },
      contrastBindings: [
        {
          kind: "FUNCTION_CONTRAST",
          contrastTarget: TARGET,
          instruction: "纸和笔用途不同。",
        },
      ],
      build: {
        enabled: true,
        groundInstruction: "桌上有一张纸。",
        connectInstruction: "纸用来书写。",
        teachInstruction: "看一看这个词。",
        fadeInstruction: "完整英文已经收起。",
        recallInstructionKey: "Produce the English word for the highlighted object.",
      },
      strengthen: {
        enabled: true,
        reconnectInstruction: "重新看一看这个词。",
        fadeInstruction: "完整英文已经收起。",
        verifyInstruction: "根据意思写出英文单词。",
      },
    },
  ],
  planning: {
    planIdNamespace: "desk",
    activeGoalId: "NAME_THE_OBJECT",
    sourceLearningNeedRef: "need-opaque-ref",
    guidedRationales: {
      ground: "Show the current entity.",
      connect: "Connect the entity to its role.",
      teach: "Present the form as teaching.",
      contrast: "Show an authored contrast.",
      fade: "Withdraw the full form.",
      reconnect: "Re-show the form.",
    },
  },
  provenance: {
    status: "CANDIDATE",
    sourceRefs: ["tests/generic-factory-non-meal"],
  },
};

const loadLexeme = (canonicalKey: string) => {
  if (canonicalKey === "test-pen-key") {
    return {
      id: TARGET.lexemeId,
      display: "pen",
      lemma: "pen",
      meaningsZh: ["笔"],
      ipa: [],
    };
  }
  if (canonicalKey === "test-paper-key") {
    return {
      id: "test-lex-paper",
      display: "paper",
      lemma: "paper",
      meaningsZh: ["纸"],
      ipa: [],
    };
  }
  return null;
};

describe("generic lexical factory is not Meal-locked", () => {
  it("builds a plan from a non-Meal skeleton and pack", () => {
    const resolved = resolveSceneContent({
      pack,
      frame,
      skeleton,
      cluster,
      loadLexeme,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }
    const plan = createContextualLexicalBuildPlan({
      frame,
      content: resolved.content,
      target: TARGET,
      stepIdPrefix: "desk",
    });
    expect(plan.mode).toBe("BUILD");
    expect(plan.skeletonId).toBe("desk-setting-v0");
    expect(plan.activeGoalId).toBe("NAME_THE_OBJECT");
    expect(plan.id).toBe("desk-build-desk-v0-pen");
    expect(plan.steps).toHaveLength(6);
    expect(plan.steps[0] && "executionIntent" in plan.steps[0]
      ? plan.steps[0].executionIntent
      : null).toMatchObject({
      rationale: "Show the current entity.",
    });
    const teach = plan.steps[2];
    expect(teach && "presentation" in teach ? teach.presentation.presentedEntityIds : null).toEqual([
      "desk-pen",
    ]);
  });

  it("uses the resolved lexeme.entityId instead of looking the sense up again", () => {
    const resolved = resolveSceneContent({
      pack,
      frame,
      skeleton,
      cluster,
      loadLexeme,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }
    const decoyFirst: typeof frame = {
      ...frame,
      entityBindings: [
        {
          entityId: "desk-decoy-pen",
          roleId: "OBJECT",
          label: "Decoy",
          conceptIds: [],
          lexemeSenseBindings: [{ sense: TARGET, bindingKind: "NAMES_ENTITY" }],
        },
        ...frame.entityBindings,
      ],
    };
    const plan = createContextualLexicalBuildPlan({
      frame: decoyFirst,
      content: resolved.content,
      target: TARGET,
      stepIdPrefix: "desk",
    });
    const teach = plan.steps[2];
    expect(teach && "presentation" in teach ? teach.presentation.presentedEntityIds : null).toEqual([
      "desk-pen",
    ]);
    expect(JSON.stringify(plan)).not.toContain("desk-decoy-pen");
  });

  it("returns an empty plan when the resolved entityId is not on the frame", () => {
    const resolved = resolveSceneContent({
      pack,
      frame,
      skeleton,
      cluster,
      loadLexeme,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }
    const otherFrame: typeof frame = {
      ...frame,
      id: "desk-other-v0",
      entityBindings: frame.entityBindings.map((entity) =>
        entity.entityId === "desk-pen"
          ? { ...entity, entityId: "desk-other-pen" }
          : entity,
      ),
    };
    const plan = createContextualLexicalBuildPlan({
      frame: otherFrame,
      content: resolved.content,
      target: TARGET,
      stepIdPrefix: "desk",
    });
    expect(plan.targets).toEqual([]);
    expect(plan.steps).toEqual([]);
  });
});
