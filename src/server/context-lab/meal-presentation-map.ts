/**
 * Candidate compatibility adapter.
 * Meal home-breakfast presentation projects from a caller-supplied pack.
 */

import type { GuidedActivityKind } from "@/contextual-learning/candidate-v0/domain/types";
import type {
  ContextEntityRole,
  PublicContextEntity,
} from "@/components/context-lab/types";
import { snapshotSceneContentFromPack } from "@/contextual-learning/candidate-v0/content/snapshot-from-pack";
import { HOME_BREAKFAST_FRAME_ID } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { experimentalMealContextLabPack } from "@/contextual-learning/candidate-v0/content/experimental-meal-runtime-pack";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";

export { HOME_BREAKFAST_FRAME_ID };

function mealPresentationRole(role: string): ContextEntityRole | undefined {
  if (role === "FOOD" || role === "CONTAINER" || role === "TOOL") {
    return role;
  }
  if (role === "SUPPORT") {
    return "CONTAINER";
  }
  if (role === "DRINK") {
    return "FOOD";
  }
  return undefined;
}

const FRAME_ONLY_ENTITIES: Record<string, { label: string; role: ContextEntityRole }> = {
  // Frame-only beverage entity for cup contains(); not a Probe target.
  "home-drink": { label: "饮料", role: "FOOD" },
  // Frame-only supported food for plate supports(); not a Probe target.
  "home-served-food": { label: "盘中食物", role: "FOOD" },
  // Frame-only vessel for water contains(); not a Probe target.
  "home-water-vessel": { label: "水壶", role: "CONTAINER" },
};

export interface MealPresentationProjection {
  title: string;
  settingLabel: string;
  introInstruction: string;
  sceneEntityIds: readonly string[];
  frameEntityIds: readonly string[];
  entities: Record<string, { label: string; role: ContextEntityRole }>;
  relationCaptions: Record<string, string>;
  contrastCaptions: Record<string, string>;
}

function entityEntriesFromSnapshot(
  resolved: NonNullable<ReturnType<typeof snapshotSceneContentFromPack>>,
): Array<[string, { label: string; role: ContextEntityRole }]> {
  return resolved.lexemes.flatMap((lexeme) => {
    const role = mealPresentationRole(lexeme.presentationRole);
    return role ? [[lexeme.entityId, { label: lexeme.displayLabel, role }]] : [];
  });
}

function relationCaptionKey(predicate: string, entityIds: readonly string[]): string {
  return `${predicate}|${entityIds.join("|")}`;
}

function relationEntriesFromSnapshot(
  resolved: NonNullable<ReturnType<typeof snapshotSceneContentFromPack>>,
): Array<[string, string]> {
  return resolved.lexemes.flatMap((lexeme) =>
    lexeme.groundingFacts
      .filter((fact) => fact.caption)
      .map(
        (fact) =>
          [
            relationCaptionKey(
              fact.predicate,
              fact.args.flatMap((arg) => (arg.kind === "ENTITY" ? [arg.entityId] : [])),
            ),
            fact.caption as string,
          ] as [string, string],
      ),
  );
}

function contrastEntriesFromSnapshot(
  resolved: NonNullable<ReturnType<typeof snapshotSceneContentFromPack>>,
): Array<[string, string]> {
  return resolved.lexemes
    .filter((lexeme) => lexeme.contrasts[0]?.caption)
    .map(
      (lexeme) =>
        [lexeme.entityId, lexeme.contrasts[0]!.caption as string] as [string, string],
    );
}

export function projectMealPresentation(
  pack?: ContextualSceneContentPack,
): MealPresentationProjection {
  const resolved = snapshotSceneContentFromPack(
    pack ?? experimentalMealContextLabPack(),
    HOME_BREAKFAST_FRAME_ID,
  );
  return {
    title: resolved?.frame.title ?? "",
    settingLabel: resolved?.frame.settingLabel ?? "",
    introInstruction: resolved?.frame.introInstruction ?? "",
    sceneEntityIds: resolved?.frame.presentationOrder ?? [],
    frameEntityIds: resolved?.frame.entityIds ?? [],
    entities: {
      ...Object.fromEntries(resolved ? entityEntriesFromSnapshot(resolved) : []),
      ...FRAME_ONLY_ENTITIES,
    },
    relationCaptions: Object.fromEntries(
      resolved ? relationEntriesFromSnapshot(resolved) : [],
    ),
    contrastCaptions: Object.fromEntries(
      resolved ? contrastEntriesFromSnapshot(resolved) : [],
    ),
  };
}

const DEFAULT_PRESENTATION = projectMealPresentation();

export const HOME_BREAKFAST_SCENE_ENTITY_IDS = DEFAULT_PRESENTATION.sceneEntityIds;

export const HOME_BREAKFAST_FRAME_ENTITY_IDS = DEFAULT_PRESENTATION.frameEntityIds;

const GUIDED_INSTRUCTIONS: Record<GuidedActivityKind, string> = {
  PRESENT_CONTEXT: DEFAULT_PRESENTATION.introInstruction,
  OBSERVE_RELATION: "先看当前物品和它在场景里的关系。",
  CONNECT_ENTITY_AND_MEANING: "把当前物品和它的意思联系起来。",
  PRESENT_LEXICAL_FORM: "这是教学，不是测试。看一看这个词和它的英文词形。",
  SHOW_CONTRAST: "比较一下这两个物品：它们有什么不同？",
  RECONNECT_FORM: "这是强化，不是测试。重新看一看这个词和它的英文词形。",
  FADE_FORM: "完整英文已经收起。下面是提示，不是答案。",
};

const STRENGTHEN_VERIFY_INSTRUCTION =
  "根据当前物品的意思，写出英文单词。当前页面没有完整答案或拼写提示。";

const FROZEN_PREVIEW_INSTRUCTION = "根据刚才看到的早餐情景，试着写出对应的英文单词。";

export function homeBreakfastFrameCopy(pack?: ContextualSceneContentPack): {
  title: string;
  settingLabel: string;
} {
  const projected = pack ? projectMealPresentation(pack) : DEFAULT_PRESENTATION;
  return { title: projected.title, settingLabel: projected.settingLabel };
}

export function guidedInstructionFor(kind: GuidedActivityKind): string {
  return GUIDED_INSTRUCTIONS[kind];
}

export function frozenPreviewInstruction(): string {
  return FROZEN_PREVIEW_INSTRUCTION;
}

export function strengthenVerifyInstruction(displayLabel?: string): string {
  if (!displayLabel) {
    return STRENGTHEN_VERIFY_INSTRUCTION;
  }
  return `根据${displayLabel}的意思，写出英文单词。当前页面没有完整答案或拼写提示。`;
}

export function strengthenReconnectInstruction(displayLabel: string): string {
  return `这是强化，不是测试。重新看一看${displayLabel}和它的英文词形。`;
}

export function strengthenTitleFor(displayLabel: string): string {
  return `加强${displayLabel}的记忆连接`;
}

export function buildTitleFor(displayLabel: string): string {
  return `建立${displayLabel}的情境记忆`;
}

export function buildVerifyInstruction(displayLabel: string): string {
  return `根据刚才看到的${displayLabel}，写出英文单词。当前页面没有完整答案或拼写提示。`;
}

export function mappedMealEntity(
  entityId: string,
  pack?: ContextualSceneContentPack,
): PublicContextEntity | undefined {
  const projected = pack ? projectMealPresentation(pack) : DEFAULT_PRESENTATION;
  const mapped = projected.entities[entityId];
  if (!mapped) {
    return undefined;
  }
  return { id: entityId, ...mapped };
}

export function relationCaptionFor(
  predicate: string,
  entityIds: readonly string[],
  pack?: ContextualSceneContentPack,
): string | undefined {
  const projected = pack ? projectMealPresentation(pack) : DEFAULT_PRESENTATION;
  return projected.relationCaptions[relationCaptionKey(predicate, entityIds)];
}

export function contrastCaptionFor(
  entityId: string,
  pack?: ContextualSceneContentPack,
): string | undefined {
  const projected = pack ? projectMealPresentation(pack) : DEFAULT_PRESENTATION;
  return projected.contrastCaptions[entityId];
}

export function sceneEntityIdsForResolvedContext(
  boundEntityIds: ReadonlySet<string>,
  pack?: ContextualSceneContentPack,
): readonly string[] {
  const projected = pack ? projectMealPresentation(pack) : DEFAULT_PRESENTATION;
  return projected.sceneEntityIds.filter((entityId) => boundEntityIds.has(entityId));
}
