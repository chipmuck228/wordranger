/**
 * Catalog-driven Meal lexical BUILD identities and scene bindings.
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Identity comes from the reviewed scene catalog + Probe target order.
 * Grounding / contrast bindings are authored, not inferred from labels.
 */

import {
  MEAL_PROBE_STRENGTHEN_ENTITY_BINDINGS,
  listMealStrengthenIdentities,
  profileForBundledTarget,
  profileForFixtureSense,
  resolveMealLexicalStrengthenProfiles,
  type MealLexemeLoader,
  type MealStrengthenStepToken,
} from "../strengthen/meal-lexical-profiles";
import type { LexemeSenseRef } from "../domain/types";
import type { MealLexicalBuildProfile, MealBuildSceneBinding } from "./types";

export const MEAL_BUILD_SCENE_BINDINGS: Record<
  MealStrengthenStepToken,
  MealBuildSceneBinding
> = {
  soup: {
    stepToken: "soup",
    relatedEntityId: "home-bowl",
    relationPredicate: "contains",
    contrastEntityId: "home-bowl",
    groundingInstruction: "桌上有汤。先看看它在场景里的位置。",
    connectInstruction: "汤是碗里的食物。",
    teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
    contrastInstruction: "汤是食物，碗是盛食物的容器。它们不是同一个东西。",
    fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
    recallInstructionKey: "Produce the English word for the highlighted food.",
  },
  bowl: {
    stepToken: "bowl",
    relatedEntityId: "home-soup",
    relationPredicate: "contains",
    contrastEntityId: "home-soup",
    groundingInstruction: "桌上有碗。先看看它在场景里的位置。",
    connectInstruction: "碗用来盛汤。",
    teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
    contrastInstruction: "碗是盛食物的容器，汤是碗里的食物。它们不是同一个东西。",
    fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
    recallInstructionKey: "Produce the English word for the highlighted container.",
  },
  spoon: {
    stepToken: "spoon",
    relatedEntityId: "home-soup",
    relationPredicate: "suitable_for",
    contrastEntityId: "home-fork",
    groundingInstruction: "桌上有汤、碗、勺子和叉子。先看看这些物品。",
    connectInstruction: "勺子适合用来喝汤或舀取流质食物。",
    teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
    contrastInstruction: "比较一下勺子和叉子：它们的用途有什么不同？",
    fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
    recallInstructionKey: "Produce the English word for the required tool.",
  },
  fork: {
    stepToken: "fork",
    contrastEntityId: "home-spoon",
    groundingInstruction: "桌上有叉子。先看看它在场景里的位置。",
    connectInstruction: "叉子是用来叉取食物的餐具。",
    teachInstruction: "这是教学，不是测试。看一看这个词和它的英文词形。",
    contrastInstruction: "比较一下叉子和勺子：它们的用途有什么不同？",
    fadeInstruction: "完整英文已经收起。下面是提示，不是答案。",
    recallInstructionKey: "Produce the English word for the highlighted tool.",
  },
};

export function mealLexicalQueueCatalog():
  | { ok: true; catalog: { target: LexemeSenseRef; entityId: string }[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  const identities = listMealStrengthenIdentities();
  if (!identities.ok) {
    return identities;
  }
  return {
    ok: true,
    catalog: identities.identities.map((identity) => ({
      target: { ...identity.target },
      entityId: identity.entityId,
    })),
  };
}

export function resolveMealLexicalBuildProfiles(input: {
  loadLexeme: MealLexemeLoader;
  displayLabelForEntity: (entityId: string) => string | null;
  allowedEntityIds: readonly string[];
}):
  | { ok: true; profiles: MealLexicalBuildProfile[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  const resolved = resolveMealLexicalStrengthenProfiles(input);
  if (!resolved.ok) {
    return resolved;
  }
  const profiles: MealLexicalBuildProfile[] = [];
  for (const profile of resolved.profiles) {
    const token = profile.stepToken as MealStrengthenStepToken;
    const binding = MEAL_BUILD_SCENE_BINDINGS[token];
    if (!binding) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    if (!input.allowedEntityIds.includes(binding.contrastEntityId)) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    if (
      binding.relatedEntityId &&
      !input.allowedEntityIds.includes(binding.relatedEntityId)
    ) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    profiles.push({
      ...profile,
      ...binding,
    });
  }
  return { ok: true, profiles };
}

export function buildProfileForBundledTarget(
  profiles: readonly MealLexicalBuildProfile[],
  target: LexemeSenseRef,
): MealLexicalBuildProfile | null {
  return profileForBundledTarget(profiles, target) as MealLexicalBuildProfile | null;
}

export function buildProfileForFixtureSense(
  profiles: readonly MealLexicalBuildProfile[],
  sense: LexemeSenseRef,
): MealLexicalBuildProfile | null {
  return profileForFixtureSense(profiles, sense) as MealLexicalBuildProfile | null;
}

export function prefixedMealEntityId(
  prefix: string,
  catalogEntityId: string,
): string | null {
  const binding = MEAL_PROBE_STRENGTHEN_ENTITY_BINDINGS.find(
    (item) => item.entityId === catalogEntityId,
  );
  return binding ? `${prefix}-${binding.stepToken}` : null;
}

export function mealSceneEntityIds(prefix: string): string[] {
  return MEAL_PROBE_STRENGTHEN_ENTITY_BINDINGS.map(
    (item) => `${prefix}-${item.stepToken}`,
  );
}
