/**
 * Catalog-driven Meal lexical STRENGTHEN identities and profiles.
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Identity comes from the reviewed scene catalog + Probe target order.
 * Surface form / gloss / IPA come from bundled vocabulary only.
 */

import { MEAL_SENSE } from "../fixtures/meal/knowledge";
import { MEAL_SCENE_CLUSTER } from "../memory-routing/scene-catalog";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "../memory-routing/bundled-lexeme-bindings";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { MealLexicalStrengthenProfile } from "./types";

export const MEAL_PROBE_STRENGTHEN_ENTITY_BINDINGS = [
  {
    entityId: "home-soup",
    fixtureKey: "soup",
    fixtureSense: MEAL_SENSE.soup,
    stepToken: "soup",
  },
  {
    entityId: "home-bowl",
    fixtureKey: "bowl",
    fixtureSense: MEAL_SENSE.bowl,
    stepToken: "bowl",
  },
  {
    entityId: "home-spoon",
    fixtureKey: "spoon",
    fixtureSense: MEAL_SENSE.spoon,
    stepToken: "spoon",
  },
  {
    entityId: "home-fork",
    fixtureKey: "fork",
    fixtureSense: MEAL_SENSE.fork,
    stepToken: "fork",
  },
] as const;

export type MealStrengthenStepToken =
  (typeof MEAL_PROBE_STRENGTHEN_ENTITY_BINDINGS)[number]["stepToken"];

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

export function listMealStrengthenIdentities():
  | { ok: true; identities: MealLexicalStrengthenIdentity[] }
  | { ok: false; reason: "MEAL_TARGET_PROFILE_UNRESOLVED" } {
  const identities: MealLexicalStrengthenIdentity[] = [];
  for (const binding of MEAL_PROBE_STRENGTHEN_ENTITY_BINDINGS) {
    const bundled = BUNDLED_LEXEME_BINDINGS[binding.fixtureKey];
    const member = MEAL_SCENE_CLUSTER.members.find(
      (item) => item.candidateFixtureLexemeId === bundled.fixtureLexemeId,
    );
    if (
      !member ||
      member.lexemeCanonicalKey !== bundled.canonicalKey ||
      member.target.senseId !== binding.fixtureSense.senseId ||
      member.target.lexemeId !== bundledBindingLexemeId(bundled)
    ) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    identities.push({
      target: { ...member.target },
      fixtureLexemeId: bundled.fixtureLexemeId,
      fixtureSense: binding.fixtureSense,
      sceneClusterId: MEAL_SCENE_CLUSTER.id,
      entityId: binding.entityId,
      roleId: member.roleId,
      canonicalKey: bundled.canonicalKey,
      stepToken: binding.stepToken,
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
  const profiles: MealLexicalStrengthenProfile[] = [];
  for (const identity of identities.identities) {
    if (!input.allowedEntityIds.includes(identity.entityId)) {
      return { ok: false, reason: "MEAL_TARGET_PROFILE_UNRESOLVED" };
    }
    const lexeme = input.loadLexeme(identity.canonicalKey);
    const displayLabel = input.displayLabelForEntity(identity.entityId);
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
    profiles.push({
      ...identity,
      displayForm,
      meaningGloss,
      displayLabel,
      phonetic,
    });
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
