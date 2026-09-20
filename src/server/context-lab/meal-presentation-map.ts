/**
 * Server-authored Meal home-breakfast presentation mapping.
 * Explicit IDs only. Do not derive labels from ID fragments.
 */

import type { GuidedActivityKind } from "@/contextual-learning/candidate-v0/domain/types";
import type {
  ContextEntityRole,
  PublicContextEntity,
} from "@/components/context-lab/types";

export const HOME_BREAKFAST_FRAME_ID = "home-breakfast-v0";

export const HOME_BREAKFAST_SCENE_ENTITY_IDS = [
  "home-soup",
  "home-bowl",
  "home-spoon",
  "home-fork",
] as const;

const HOME_BREAKFAST_ENTITIES: Record<
  string,
  { label: string; role: ContextEntityRole }
> = {
  "home-soup": { label: "汤", role: "FOOD" },
  "home-bowl": { label: "碗", role: "CONTAINER" },
  "home-spoon": { label: "勺子", role: "TOOL" },
  "home-fork": { label: "叉子", role: "TOOL" },
};

const HOME_BREAKFAST_COPY = {
  title: "早餐时间",
  settingLabel: "看看桌上的食物和餐具。",
};

const GUIDED_INSTRUCTIONS: Record<GuidedActivityKind, string> = {
  PRESENT_CONTEXT: "桌上有汤、碗、勺子和叉子。先看看这些物品。",
  OBSERVE_RELATION: "勺子适合用来喝汤或舀取流质食物。",
  SHOW_CONTRAST: "比较一下勺子和叉子：它们的用途有什么不同？",
};

const FROZEN_PREVIEW_INSTRUCTION = "根据刚才看到的早餐情景，试着写出对应的英文单词。";

const RELATION_CAPTIONS: Record<string, string> = {
  "suitable_for|home-spoon|home-soup": "勺子 → 适合舀汤",
};

const CONTRAST_CAPTIONS: Record<string, string> = {
  "home-spoon": "勺子：舀取汤或柔软食物",
  "home-fork": "叉子：叉取食物块",
};

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
  return RELATION_CAPTIONS[`${predicate}|${entityIds.join("|")}`];
}

export function contrastCaptionFor(entityId: string): string | undefined {
  return CONTRAST_CAPTIONS[entityId];
}
