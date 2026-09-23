import "server-only";

import type { LexemeSenseRef } from "@/contextual-learning/candidate-v0/domain/types";
import {
  buildProfileForBundledTarget,
  buildProfileForFixtureSense,
  resolveMealLexicalBuildProfiles,
} from "@/contextual-learning/candidate-v0/build/meal-lexical-build-profiles";
import type { MealLexicalBuildProfile } from "@/contextual-learning/candidate-v0/build/types";
import { experimentalMealContextLabPack } from "@/contextual-learning/candidate-v0/content/experimental-meal-runtime-pack";
import { HOME_BREAKFAST_FRAME_ID } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import { snapshotSceneContentFromPack } from "@/contextual-learning/candidate-v0/content/snapshot-from-pack";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import {
  profileForBundledTarget,
  profileForFixtureSense,
  resolveMealLexicalStrengthenProfiles,
} from "@/contextual-learning/candidate-v0/strengthen/meal-lexical-profiles";
import type { MealLexicalStrengthenProfile } from "@/contextual-learning/candidate-v0/strengthen/types";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import {
  HOME_BREAKFAST_FRAME_ENTITY_IDS,
  mappedMealEntity,
} from "./meal-presentation-map";

function packsForLookup(
  pack?: ContextualSceneContentPack,
): ContextualSceneContentPack[] {
  return [pack ?? experimentalMealContextLabPack()];
}

function resolveInputForPack(pack: ContextualSceneContentPack) {
  const snapshot = snapshotSceneContentFromPack(pack, HOME_BREAKFAST_FRAME_ID);
  return {
    loadLexeme: bundledSceneLexemeLoader,
    displayLabelForEntity: (entityId: string) =>
      snapshot?.lexemes.find((item) => item.entityId === entityId)?.displayLabel ??
      mappedMealEntity(entityId)?.label ??
      null,
    allowedEntityIds: snapshot?.frame.entityIds ?? HOME_BREAKFAST_FRAME_ENTITY_IDS,
    pack,
  };
}

export function loadMealLexicalStrengthenProfiles(
  pack?: ContextualSceneContentPack,
):
  | { ok: true; profiles: MealLexicalStrengthenProfile[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  return resolveMealLexicalStrengthenProfiles(
    resolveInputForPack(pack ?? experimentalMealContextLabPack()),
  );
}

export function mealProfileForTarget(
  target: LexemeSenseRef,
  pack?: ContextualSceneContentPack,
): MealLexicalStrengthenProfile | null {
  for (const candidate of packsForLookup(pack)) {
    const resolved = loadMealLexicalStrengthenProfiles(candidate);
    if (!resolved.ok) {
      continue;
    }
    const found =
      profileForBundledTarget(resolved.profiles, target) ??
      profileForFixtureSense(resolved.profiles, target);
    if (found) {
      return found;
    }
  }
  return null;
}

export function loadMealLexicalBuildProfiles(
  pack?: ContextualSceneContentPack,
):
  | { ok: true; profiles: MealLexicalBuildProfile[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  return resolveMealLexicalBuildProfiles(
    resolveInputForPack(pack ?? experimentalMealContextLabPack()),
  );
}

export function mealBuildProfileForTarget(
  target: LexemeSenseRef,
  pack?: ContextualSceneContentPack,
): MealLexicalBuildProfile | null {
  for (const candidate of packsForLookup(pack)) {
    const resolved = loadMealLexicalBuildProfiles(candidate);
    if (!resolved.ok) {
      continue;
    }
    const found =
      buildProfileForBundledTarget(resolved.profiles, target) ??
      buildProfileForFixtureSense(resolved.profiles, target);
    if (found) {
      return found;
    }
  }
  return null;
}
