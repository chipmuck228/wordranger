/**
 * Test-only synthetic Meal release packs.
 * Never imported by production registry, bundled runtime, or /train.
 */

import {
  currentPackTargetFingerprint,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
} from "@/contextual-learning/candidate-v0/content";
import type {
  ContextualSceneContentPack,
  ContextualSceneLexemeContent,
  SceneLexemeLoader,
} from "@/contextual-learning/candidate-v0/content/types";
import type { ContextFrame, LexemeSenseRef } from "@/contextual-learning/candidate-v0/domain/types";
import { MEAL_BATCH_02_FRAMES } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-02-contexts";
import { mealBatch02Skeleton } from "@/contextual-learning/candidate-v0/fixtures/meal/meal-batch-02-skeleton";
import { entityArg, fact } from "@/contextual-learning/candidate-v0/fixtures/shared";
import {
  HOME_BREAKFAST_FRAME_ID,
  RESTAURANT_MEAL_FRAME_ID,
} from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import type { ReleaseApprovalSource, ReleaseContextSnapshot } from "@/contextual-learning/candidate-v0/release";
import { MEAL_RELEASE_SCENE_ID } from "@/contextual-learning/candidate-v0/release";
import type { ContentReviewRepository } from "@/server/contextual-content-review/content-review-repository";
import type { HumanContentReviewRecord } from "@/server/contextual-content-review/types";
import { fileContentReviewRepository } from "@/server/contextual-content-review/file-content-review-repository";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";

export interface SyntheticReleaseFixture {
  pack: ContextualSceneContentPack;
  extraApprovalSources: ReleaseApprovalSource[];
  extraPacks: ContextualSceneContentPack[];
  extraReviewTargets: Array<{
    reviewKey: string;
    packId: string;
    target: LexemeSenseRef;
    sourceRefs: readonly string[];
  }>;
  context: ReleaseContextSnapshot;
  loadLexeme: SceneLexemeLoader;
  reviewRepository: ContentReviewRepository;
  parentPackId: string;
  records: Map<string, HumanContentReviewRecord>;
}

function bowlTarget(pack: ContextualSceneContentPack): LexemeSenseRef {
  const bowl = pack.lexemes.find((item) => item.id === "meal-bowl");
  if (!bowl) {
    throw new Error("synthetic fixture requires inherited bowl");
  }
  return bowl.target;
}

function syntheticLexeme(
  index: number,
  contrast: LexemeSenseRef,
): ContextualSceneLexemeContent {
  const slug = `synth-rel-${String(index).padStart(2, "0")}`;
  const lexemeId = `test-lex-${slug}`;
  const senseId = `test-${slug}#sense`;
  const homeEntity = `home-${slug}`;
  const restEntity = `rest-${slug}`;
  const homeFact = `home-fact-suitable-for-${slug}`;
  const restFact = `rest-fact-suitable-for-${slug}`;
  const sceneOrder = 5 + index;
  return {
    id: `synthetic-meal-${slug}`,
    target: { lexemeId, senseId },
    fixtureSense: { lexemeId, senseId },
    canonicalKey: slug,
    lexicalPresentation: {
      displayFormSource: "BUNDLED_VOCABULARY",
      meaningGlossSource: "BUNDLED_VOCABULARY",
      phoneticSource: "BUNDLED_VOCABULARY",
      displayLabel: `义项${index}`,
      meaningGlossSelector: {
        kind: "EXACT_BUNDLED_VALUE",
        value: `义项${index}`,
      },
    },
    membership: {
      frameBindings: [
        {
          frameId: HOME_BREAKFAST_FRAME_ID,
          entityId: homeEntity,
          roleId: "EATING_TOOL",
          sceneOrder,
        },
        {
          frameId: RESTAURANT_MEAL_FRAME_ID,
          entityId: restEntity,
          roleId: "EATING_TOOL",
          sceneOrder,
        },
      ],
      presentationToken: slug,
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
        {
          frameId: HOME_BREAKFAST_FRAME_ID,
          facts: [
            {
              factId: homeFact,
              predicate: "suitable_for",
              args: [
                { kind: "ENTITY", entityId: homeEntity },
                { kind: "ENTITY", entityId: "home-soup" },
              ],
              caption: "工具适合当前食物",
            },
          ],
        },
        {
          frameId: RESTAURANT_MEAL_FRAME_ID,
          facts: [
            {
              factId: restFact,
              predicate: "suitable_for",
              args: [
                { kind: "ENTITY", entityId: restEntity },
                { kind: "ENTITY", entityId: "rest-soup" },
              ],
              caption: "工具适合当前食物",
            },
          ],
        },
      ],
    },
    contrastBindings: [
      {
        kind: "FUNCTION_CONTRAST",
        contrastTarget: contrast,
        instruction: "比较一下这个工具和碗：它们的用途有什么不同？",
        caption: "测试工具：不是碗",
      },
    ],
    build: {
      enabled: true,
      groundInstruction: "桌上有一个测试物品。先看看它在场景里的位置。",
      connectInstruction: "这个物品是当前场景里的一件餐具。",
      connectFactByFrame: [
        { frameId: HOME_BREAKFAST_FRAME_ID, factId: homeFact },
        { frameId: RESTAURANT_MEAL_FRAME_ID, factId: restFact },
      ],
      teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      recallInstructionKey: "Produce the English word for the highlighted tool.",
    },
    strengthen: {
      enabled: true,
      reconnectInstruction: "这是强化，不是测试。重新看一看这个物品和它的英文词形。",
      fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
      verifyInstruction: "根据当前物品的意思，写出英文单词。当前页面没有完整答案或拼写提示。",
    },
  };
}

function attachSyntheticTarget(
  pack: ContextualSceneContentPack,
  frames: ContextFrame[],
  lexeme: ContextualSceneLexemeContent,
): { pack: ContextualSceneContentPack; frames: ContextFrame[] } {
  const nextPack = structuredClone(pack);
  const nextFrames = frames.map((frame) => structuredClone(frame));
  nextPack.lexemes.push(lexeme);
  for (const binding of lexeme.membership.frameBindings) {
    const packFrame = nextPack.frames.find((item) => item.frameId === binding.frameId);
    const runtime = nextFrames.find((item) => item.id === binding.frameId);
    const group = lexeme.grounding.frameFacts.find((item) => item.frameId === binding.frameId);
    const factRef = group?.facts[0];
    if (!packFrame || !runtime || !factRef) {
      throw new Error(`synthetic fixture missing frame ${binding.frameId}`);
    }
    if (!packFrame.entityIds.includes(binding.entityId)) {
      packFrame.entityIds.push(binding.entityId);
    }
    if (!packFrame.presentationOrder.includes(binding.entityId)) {
      packFrame.presentationOrder.push(binding.entityId);
    }
    if (!packFrame.factIds.includes(factRef.factId)) {
      packFrame.factIds.push(factRef.factId);
    }
    runtime.entityBindings.push({
      entityId: binding.entityId,
      roleId: binding.roleId,
      label: `Synthetic ${lexeme.canonicalKey}`,
      conceptIds: ["concept-eating-tool"],
      lexemeSenseBindings: [{ sense: lexeme.fixtureSense, bindingKind: "NAMES_ENTITY" }],
    });
    runtime.initialFacts.push(
      fact(
        "suitable_for",
        [entityArg(binding.entityId), entityArg(factRef.args[1] && factRef.args[1].kind === "ENTITY" ? factRef.args[1].entityId : "")],
        factRef.factId,
      ),
    );
  }
  return { pack: nextPack, frames: nextFrames };
}

export function mapReviewRepository(
  records: Map<string, HumanContentReviewRecord | null>,
): ContentReviewRepository {
  return {
    async get(reviewKey) {
      if (records.has(reviewKey)) {
        return records.get(reviewKey) ?? null;
      }
      return fileContentReviewRepository.get(reviewKey);
    },
    async saveIfRevision() {
      throw new Error("synthetic release tests must not write reviews");
    },
    async commit() {
      throw new Error("synthetic release tests must not write reviews");
    },
  };
}

export function createSyntheticMealReleaseFixture(extraTargetCount: number): SyntheticReleaseFixture {
  if (extraTargetCount < 1) {
    throw new Error("synthetic fixture adds at least one extra target");
  }
  let pack = structuredClone(MEAL_SCENE_EXPANSION_BATCH_02_PACK);
  let frames = MEAL_BATCH_02_FRAMES.map((frame) => structuredClone(frame));
  pack.id = `synthetic-meal-release-${6 + extraTargetCount}-v0`;
  pack.provenance = {
    ...pack.provenance,
    sourceRefs: [...pack.provenance.sourceRefs, "tests/contextual-content-release/helpers/synthetic-release-pack.ts"],
    authoredAt: "2026-09-22",
  };
  const contrast = bowlTarget(pack);
  const extraLexemes: ContextualSceneLexemeContent[] = [];
  for (let index = 1; index <= extraTargetCount; index += 1) {
    const lexeme = syntheticLexeme(index, contrast);
    extraLexemes.push(lexeme);
    const attached = attachSyntheticTarget(pack, frames, lexeme);
    pack = attached.pack;
    frames = attached.frames;
  }
  const extraReviewTargets = extraLexemes.map((lexeme) => ({
    reviewKey: `synthetic-meal-release-${lexeme.canonicalKey}`,
    packId: pack.id,
    target: lexeme.target,
    sourceRefs: [...pack.provenance.sourceRefs],
  }));
  const extraApprovalSources: ReleaseApprovalSource[] = extraReviewTargets.map((item) => ({
    sceneId: MEAL_RELEASE_SCENE_ID,
    reviewKey: item.reviewKey,
    target: item.target,
    expectedTarget: item.target,
    approvalBasis: "HUMAN_REVIEW_PROMOTION",
    approvalPackId: item.packId,
    sourceRefs: [...item.sourceRefs],
  }));
  const records = new Map<string, HumanContentReviewRecord>();
  for (const lexeme of extraLexemes) {
    const reviewKey = `synthetic-meal-release-${lexeme.canonicalKey}`;
    const contentFingerprint = currentPackTargetFingerprint(pack, lexeme.target);
    if (!contentFingerprint) {
      throw new Error(`missing synthetic fingerprint for ${lexeme.id}`);
    }
    records.set(reviewKey, {
      schemaVersion: "candidate-v0",
      reviewKey,
      packId: pack.id,
      target: lexeme.target,
      contentFingerprint,
      decision: "APPROVED",
      notes: ["synthetic test approval"],
      reviewedAt: "2026-09-22T00:00:00.000Z",
      revision: 1,
      reviewer: "LOCAL_INTERNAL_REVIEWER",
    });
  }
  const loadLexeme: SceneLexemeLoader = (canonicalKey) => {
    const extra = extraLexemes.find((item) => item.canonicalKey === canonicalKey);
    if (!extra) {
      return bundledSceneLexemeLoader(canonicalKey);
    }
    const index = extra.canonicalKey.slice(-2);
    const n = Number(index);
    const token = `item${String.fromCharCode(97 + Math.floor(n / 26))}${String.fromCharCode(97 + (n % 26))}`;
    return {
      id: extra.target.lexemeId,
      display: token,
      lemma: token,
      meaningsZh: [`义项${Number(index)}`],
      ipa: [],
    };
  };
  return {
    pack,
    extraApprovalSources,
    extraPacks: [pack],
    extraReviewTargets,
    context: {
      runtimeContextId: "MEAL_BATCH_02",
      frames,
      skeleton: structuredClone(mealBatch02Skeleton),
    },
    loadLexeme,
    reviewRepository: mapReviewRepository(records),
    parentPackId: MEAL_SCENE_EXPANSION_BATCH_02_PACK.id,
    records,
  };
}
