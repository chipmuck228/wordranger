import "server-only";

import type { LexemeSenseRef } from "@/contextual-learning/candidate-v0/domain/types";
import {
  buildProfileForBundledTarget,
  buildProfileForFixtureSense,
  resolveMealLexicalBuildProfiles,
} from "@/contextual-learning/candidate-v0/build/meal-lexical-build-profiles";
import type { MealLexicalBuildProfile } from "@/contextual-learning/candidate-v0/build/types";
import {
  profileForBundledTarget,
  profileForFixtureSense,
  resolveMealLexicalStrengthenProfiles,
} from "@/contextual-learning/candidate-v0/strengthen/meal-lexical-profiles";
import type { MealLexicalStrengthenProfile } from "@/contextual-learning/candidate-v0/strengthen/types";
import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import {
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  mappedMealEntity,
} from "./meal-presentation-map";

export function loadMealLexicalStrengthenProfiles():
  | { ok: true; profiles: MealLexicalStrengthenProfile[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  return resolveMealLexicalStrengthenProfiles({
    loadLexeme: bundledSceneLexemeLoader,
    displayLabelForEntity: (entityId) => mappedMealEntity(entityId)?.label ?? null,
    allowedEntityIds: HOME_BREAKFAST_SCENE_ENTITY_IDS,
  });
}

export function mealProfileForTarget(
  target: LexemeSenseRef,
): MealLexicalStrengthenProfile | null {
  const resolved = loadMealLexicalStrengthenProfiles();
  if (!resolved.ok) {
    return null;
  }
  return (
    profileForBundledTarget(resolved.profiles, target) ??
    profileForFixtureSense(resolved.profiles, target)
  );
}

export function loadMealLexicalBuildProfiles():
  | { ok: true; profiles: MealLexicalBuildProfile[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  return resolveMealLexicalBuildProfiles({
    loadLexeme: bundledSceneLexemeLoader,
    displayLabelForEntity: (entityId) => mappedMealEntity(entityId)?.label ?? null,
    allowedEntityIds: HOME_BREAKFAST_SCENE_ENTITY_IDS,
  });
}

export function mealBuildProfileForTarget(
  target: LexemeSenseRef,
): MealLexicalBuildProfile | null {
  const resolved = loadMealLexicalBuildProfiles();
  if (!resolved.ok) {
    return null;
  }
  return (
    buildProfileForBundledTarget(resolved.profiles, target) ??
    buildProfileForFixtureSense(resolved.profiles, target)
  );
}
