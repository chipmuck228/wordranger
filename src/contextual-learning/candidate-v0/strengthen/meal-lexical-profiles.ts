/**
 * Candidate compatibility adapter.
 * Meal STRENGTHEN identities project from the Scene Content pack.
 * This file is not a second authored truth.
 */

import {
  HOME_BREAKFAST_FRAME_ID,
  MEAL_SCENE_CONTENT_PACK,
} from "../content/packs/meal/meal-scene-content";
import { snapshotSceneContentFromPack } from "../content/snapshot-from-pack";
import {
  findResolvedLexeme,
  projectStrengthenIdentity,
  projectStrengthenProfile,
} from "../content/project-from-resolved";
import { MEAL_SCENE_CLUSTER } from "../memory-routing/scene-catalog";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "../memory-routing/bundled-lexeme-bindings";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { MealLexicalStrengthenProfile } from "./types";

export type MealStrengthenStepToken = string;

export interface MealLexicalStrengthenIdentity {
  target: LexemeSenseRef;
  fixtureLexemeId: string;
  fixtureSense: LexemeSenseRef;
  sceneClusterId: string;
  entityId: string;
  roleId: string;
  canonicalKey: string;
  stepToken: MealStrengthenStepToken;
}

export type MealLexemeLoader = (canonicalKey: string) => {
  id: string;
  display: string;
  lemma: string;
  meaningsZh: readonly string[];
  ipa: readonly string[];
} | null;

function mealSnapshot() {
  return snapshotSceneContentFromPack(
    MEAL_SCENE_CONTENT_PACK,
    HOME_BREAKFAST_FRAME_ID,
  );
}

/** @deprecated Candidate compatibility projection. Prefer Scene Content pack. */
export const MEAL_PROBE_STRENGTHEN_ENTITY_BINDINGS = MEAL_SCENE_CONTENT_PACK.lexemes
  .slice()
  .sort((left, right) => left.membership.sceneOrder - right.membership.sceneOrder)
  .map((lexeme) => ({
    entityId: lexeme.membership.entityId,
    fixtureKey: lexeme.membership.presentationToken,
    fixtureSense: lexeme.fixtureSense,
    stepToken: lexeme.membership.presentationToken,
  }));

export function listMealStrengthenIdentities():
  | { ok: true; identities: MealLexicalStrengthenIdentity[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  const snapshot = mealSnapshot();
  if (!snapshot) {
    return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
  }
  const identities: MealLexicalStrengthenIdentity[] = [];
  for (const lexeme of snapshot.lexemes) {
    const bundled = Object.values(BUNDLED_LEXEME_BINDINGS).find(
      (binding) => binding.canonicalKey === lexeme.canonicalKey,
    );
    const member = MEAL_SCENE_CLUSTER.members.find(
      (item) => item.lexemeCanonicalKey === lexeme.canonicalKey,
    );
    if (
      !bundled ||
      !member ||
      member.target.senseId !== lexeme.target.senseId ||
      member.target.lexemeId !== bundledBindingLexemeId(bundled)
    ) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    identities.push({
      ...projectStrengthenIdentity(lexeme),
      sceneClusterId: snapshot.sceneClusterId,
    });
  }
  return { ok: true, identities };
}

export function resolveMealLexicalStrengthenProfiles(input: {
  loadLexeme: MealLexemeLoader;
  displayLabelForEntity: (entityId: string) => string | null;
  allowedEntityIds: readonly string[];
}):
  | { ok: true; profiles: MealLexicalStrengthenProfile[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  const identities = listMealStrengthenIdentities();
  if (!identities.ok) {
    return identities;
  }
  const snapshot = mealSnapshot();
  if (!snapshot) {
    return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
  }
  const profiles: MealLexicalStrengthenProfile[] = [];
  for (const identity of identities.identities) {
    if (!input.allowedEntityIds.includes(identity.entityId)) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    const lexeme = input.loadLexeme(identity.canonicalKey);
    const displayLabel =
      input.displayLabelForEntity(identity.entityId) ??
      findResolvedLexeme(snapshot, identity.target)?.displayLabel ??
      "";
    const displayForm = lexeme?.display.trim() || lexeme?.lemma.trim() || "";
    const meaningGloss = lexeme?.meaningsZh[0]?.trim() || "";
    const phonetic = lexeme?.ipa[0]?.trim() || undefined;
    if (
      !lexeme ||
      !displayLabel ||
      !displayForm ||
      !meaningGloss ||
      lexeme.id !== identity.target.lexemeId
    ) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    const resolved = findResolvedLexeme(snapshot, identity.target);
    profiles.push(
      resolved
        ? {
            ...projectStrengthenProfile(resolved, snapshot.sceneClusterId),
            displayForm,
            meaningGloss,
            displayLabel,
            phonetic,
          }
        : {
            ...identity,
            displayForm,
            meaningGloss,
            displayLabel,
            phonetic,
          },
    );
  }
  return { ok: true, profiles };
}

export function identityForFixtureSense(
  sense: LexemeSenseRef,
): MealLexicalStrengthenIdentity | null {
  const listed = listMealStrengthenIdentities();
  if (!listed.ok) {
    return null;
  }
  return (
    listed.identities.find((item) => sameLexemeSense(item.fixtureSense, sense)) ??
    null
  );
}

export function identityForBundledTarget(
  target: LexemeSenseRef,
): MealLexicalStrengthenIdentity | null {
  const listed = listMealStrengthenIdentities();
  if (!listed.ok) {
    return null;
  }
  return listed.identities.find((item) => sameLexemeSense(item.target, target)) ?? null;
}

export function profileForFixtureSense(
  profiles: readonly MealLexicalStrengthenProfile[],
  sense: LexemeSenseRef,
): MealLexicalStrengthenProfile | null {
  return profiles.find((profile) => sameLexemeSense(profile.fixtureSense, sense)) ?? null;
}

export function profileForBundledTarget(
  profiles: readonly MealLexicalStrengthenProfile[],
  target: LexemeSenseRef,
): MealLexicalStrengthenProfile | null {
  return profiles.find((profile) => sameLexemeSense(profile.target, target)) ?? null;
}
