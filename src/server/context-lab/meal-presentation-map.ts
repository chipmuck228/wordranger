/**
 * Candidate compatibility adapter.
 * Meal home-breakfast presentation projects from the Scene Content pack.
 */

import type { GuidedActivityKind } from "@/contextual-learning/candidate-v0/domain/types";
import type {
  ContextEntityRole,
  PublicContextEntity,
} from "@/components/context-lab/types";
import { snapshotSceneContentFromPack } from "@/contextual-learning/candidate-v0/content/snapshot-from-pack";
import { HOME_BREAKFAST_FRAME_ID } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { experimentalMealContextLabPack } from "@/contextual-learning/candidate-v0/content/experimental-meal-runtime-pack";
import { MEAL_SCENE_EXPANSION_BATCH_03_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-expansion-batch-03";

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

const snapshot = snapshotSceneContentFromPack(
  experimentalMealContextLabPack(),
  HOME_BREAKFAST_FRAME_ID,
);
const batch03Snapshot = snapshotSceneContentFromPack(
  MEAL_SCENE_EXPANSION_BATCH_03_PACK,
  HOME_BREAKFAST_FRAME_ID,
);

export const HOME_BREAKFAST_SCENE_ENTITY_IDS = (snapshot?.frame.presentationOrder ??
  []) as readonly string[];

export const HOME_BREAKFAST_FRAME_ENTITY_IDS = (snapshot?.frame.entityIds ??
  []) as readonly string[];

export const MEAL_BATCH_03_SCENE_ENTITY_IDS = (
  batch03Snapshot?.frame.presentationOrder ?? []
) as readonly string[];

function entityEntriesFromSnapshot(
  resolved: NonNullable<typeof snapshot>,
): Array<[string, { label: string; role: ContextEntityRole }]> {
  return resolved.lexemes.flatMap((lexeme) => {
    const role = mealPresentationRole(lexeme.presentationRole);
    return role ? [[lexeme.entityId, { label: lexeme.displayLabel, role }]] : [];
  });
}

const HOME_BREAKFAST_ENTITIES: Record<
  string,
  { label: string; role: ContextEntityRole }
> = {
  ...Object.fromEntries(snapshot ? entityEntriesFromSnapshot(snapshot) : []),
  ...Object.fromEntries(
    batch03Snapshot ? entityEntriesFromSnapshot(batch03Snapshot) : [],
  ),
  // Frame-only beverage entity for cup contains(); not a Probe target.
  "home-drink": { label: "饮料", role: "FOOD" },
  // Frame-only supported food for plate supports(); not a Probe target.
  "home-served-food": { label: "盘中食物", role: "FOOD" },
  // Frame-only vessel for water contains(); not a Probe target.
  "home-water-vessel": { label: "水壶", role: "CONTAINER" },
};

const HOME_BREAKFAST_COPY = {
  title: snapshot?.frame.title ?? "",
  settingLabel: snapshot?.frame.settingLabel ?? "",
};

const GUIDED_INSTRUCTIONS: Record<GuidedActivityKind, string> = {
  PRESENT_CONTEXT: snapshot?.frame.introInstruction ?? "",
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

function relationCaptionKey(predicate: string, entityIds: readonly string[]): string {
  return `${predicate}|${entityIds.join("|")}`;
}

function relationEntriesFromSnapshot(
  resolved: NonNullable<typeof snapshot>,
): Array<[string, string]> {
  return resolved.lexemes.flatMap((lexeme) =>
    lexeme.groundingFacts
      .filter((fact) => fact.caption)
      .map((fact) => [
        relationCaptionKey(
          fact.predicate,
          fact.args.flatMap((arg) => (arg.kind === "ENTITY" ? [arg.entityId] : [])),
        ),
        fact.caption as string,
      ] as [string, string]),
  );
}

const RELATION_CAPTIONS: Record<string, string> = Object.fromEntries([
  ...(snapshot ? relationEntriesFromSnapshot(snapshot) : []),
  ...(batch03Snapshot ? relationEntriesFromSnapshot(batch03Snapshot) : []),
]);

function contrastEntriesFromSnapshot(
  resolved: NonNullable<typeof snapshot>,
): Array<[string, string]> {
  return resolved.lexemes
    .filter((lexeme) => lexeme.contrasts[0]?.caption)
    .map(
      (lexeme) =>
        [lexeme.entityId, lexeme.contrasts[0]!.caption as string] as [string, string],
    );
}

const CONTRAST_CAPTIONS: Record<string, string> = Object.fromEntries([
  ...(snapshot ? contrastEntriesFromSnapshot(snapshot) : []),
  ...(batch03Snapshot ? contrastEntriesFromSnapshot(batch03Snapshot) : []),
]);

export function homeBreakfastFrameCopy(): {
  title: string;
  settingLabel: string;
} {
  return { ...HOME_BREAKFAST_COPY };
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
): PublicContextEntity | undefined {
  const mapped = HOME_BREAKFAST_ENTITIES[entityId];
  if (!mapped) {
    return undefined;
  }
  return { id: entityId, ...mapped };
}

export function relationCaptionFor(
  predicate: string,
  entityIds: readonly string[],
): string | undefined {
  return RELATION_CAPTIONS[relationCaptionKey(predicate, entityIds)];
}

export function contrastCaptionFor(entityId: string): string | undefined {
  return CONTRAST_CAPTIONS[entityId];
}

export function sceneEntityIdsForResolvedContext(
  boundEntityIds: ReadonlySet<string>,
): readonly string[] {
  const extras = MEAL_BATCH_03_SCENE_ENTITY_IDS.filter(
    (entityId) =>
      boundEntityIds.has(entityId) &&
      !HOME_BREAKFAST_SCENE_ENTITY_IDS.includes(entityId),
  );
  return [...HOME_BREAKFAST_SCENE_ENTITY_IDS, ...extras];
}
