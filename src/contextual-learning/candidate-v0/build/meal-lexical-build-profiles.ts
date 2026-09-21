/**
 * Candidate compatibility adapter.
 * Meal BUILD profiles project from the Scene Content pack.
 * This file is not a second authored truth.
 */

import { MEAL_SCENE_CONTENT_PACK } from "../content/packs/meal/meal-scene-content";
import { snapshotSceneContentFromPack } from "../content/snapshot-from-pack";
import { HOME_BREAKFAST_FRAME_ID } from "../content/packs/meal/meal-scene-content";
import { projectBuildProfile } from "../content/project-from-resolved";
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

function mealSnapshot() {
  return snapshotSceneContentFromPack(
    MEAL_SCENE_CONTENT_PACK,
    HOME_BREAKFAST_FRAME_ID,
  );
}

function projectedBindings(): Record<string, MealBuildSceneBinding> {
  const snapshot = mealSnapshot();
  const bindings: Record<string, MealBuildSceneBinding> = {};
  if (!snapshot) {
    return bindings;
  }
  for (const lexeme of snapshot.lexemes) {
    const projected = projectBuildProfile(lexeme, snapshot.sceneClusterId);
    bindings[lexeme.presentationToken] = {
      stepToken: lexeme.presentationToken,
      relatedEntityId: projected.relatedEntityId,
      relationPredicate: projected.relationPredicate,
      contrastEntityId: projected.contrastEntityId,
      groundingInstruction: projected.groundingInstruction,
      connectInstruction: projected.connectInstruction,
      teachInstruction: projected.teachInstruction,
      contrastInstruction: projected.contrastInstruction,
      fadeInstruction: projected.fadeInstruction,
      recallInstructionKey: projected.recallInstructionKey,
    };
  }
  return bindings;
}

/** @deprecated Candidate compatibility projection. Prefer Scene Content pack. */
export const MEAL_BUILD_SCENE_BINDINGS: Record<
  MealStrengthenStepToken,
  MealBuildSceneBinding
> = projectedBindings();

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
  const snapshot = mealSnapshot();
  if (!snapshot) {
    return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
  }
  const profiles: MealLexicalBuildProfile[] = [];
  for (const profile of resolved.profiles) {
    const lexeme = snapshot.lexemes.find(
      (item) => item.presentationToken === profile.stepToken,
    );
    if (!lexeme) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    const projected = projectBuildProfile(lexeme, snapshot.sceneClusterId);
    if (!input.allowedEntityIds.includes(projected.contrastEntityId)) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    if (
      projected.relatedEntityId &&
      !input.allowedEntityIds.includes(projected.relatedEntityId)
    ) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    profiles.push({
      ...profile,
      relatedEntityId: projected.relatedEntityId,
      relationPredicate: projected.relationPredicate,
      contrastEntityId: projected.contrastEntityId,
      groundingInstruction: projected.groundingInstruction,
      connectInstruction: projected.connectInstruction,
      teachInstruction: projected.teachInstruction,
      contrastInstruction: projected.contrastInstruction,
      fadeInstruction: projected.fadeInstruction,
      recallInstructionKey: projected.recallInstructionKey,
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
