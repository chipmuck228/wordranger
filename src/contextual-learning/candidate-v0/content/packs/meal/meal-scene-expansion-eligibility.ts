/**
 * Meal Scene expansion batch 01 eligibility matrix.
 * Candidate / Experimental / Not Approved.
 *
 * Authored audit of catalog-mapped Meal words that are not yet in the
 * approved four-word Scene Content pack. Not a runtime engine.
 * Not 1600-word coverage.
 */

import { sameLexemeSense } from "../../../domain/lexeme-sense";
import { MEAL_FRAMES, mealPrefixForFrame } from "../../../fixtures/meal/contexts";
import { MEAL_SENSE } from "../../../fixtures/meal/knowledge";
import { mealSkeleton } from "../../../fixtures/meal/skeleton";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "../../../memory-routing/bundled-lexeme-bindings";
import { MEAL_SCENE_CLUSTER } from "../../../memory-routing/scene-catalog";
import type { ContextLexemeBindingKind } from "../../../domain/types";

export const MEAL_EXPANSION_BATCH_01_WORDS = [
  "cup",
  "drink",
  "plate",
  "eat",
  "choose",
] as const;

export type MealExpansionBatch01Word = (typeof MEAL_EXPANSION_BATCH_01_WORDS)[number];

export type MealExpansionEligibilityResult =
  | "ELIGIBLE_NOW"
  | "REQUIRES_FRAME_CONTENT"
  | "REQUIRES_CANDIDATE_SCHEMA"
  | "FROZEN_CAPABILITY_GAP"
  | "SENSE_REVIEW_REQUIRED";

export type MealExpansionBindingKind = ContextLexemeBindingKind | "NONE";

export interface MealExpansionWordEligibility {
  word: MealExpansionBatch01Word;
  bundledLexemeId: string;
  canonicalKey: string;
  exactSenseId: string;
  catalogRole: string | null;
  skeletonRoleExists: boolean;
  frameBindingExists: boolean;
  factGroundingExists: boolean;
  bindingKind: MealExpansionBindingKind;
  probeEligible: boolean;
  buildEligible: boolean;
  strengthenEligible: boolean;
  result: MealExpansionEligibilityResult;
  gap: string;
}

function catalogMember(word: MealExpansionBatch01Word) {
  const canonicalKey = BUNDLED_LEXEME_BINDINGS[word].canonicalKey;
  return (
    MEAL_SCENE_CLUSTER.members.find((member) => member.lexemeCanonicalKey === canonicalKey) ??
    null
  );
}

function skeletonHasRole(roleId: string | null): boolean {
  return Boolean(
    roleId && mealSkeleton.roleDefinitions.some((role) => role.id === roleId),
  );
}

function frameEntitiesFor(word: MealExpansionBatch01Word) {
  const sense = MEAL_SENSE[word];
  return MEAL_FRAMES.flatMap((frame) =>
    frame.entityBindings.filter((entity) =>
      entity.lexemeSenseBindings?.some((binding) => sameLexemeSense(binding.sense, sense)),
    ),
  );
}

function frameBindingExists(word: MealExpansionBatch01Word): boolean {
  const sense = MEAL_SENSE[word];
  return MEAL_FRAMES.every((frame) =>
    frame.entityBindings.some((entity) =>
      entity.lexemeSenseBindings?.some((binding) => sameLexemeSense(binding.sense, sense)),
    ),
  );
}

function bindingKindFor(word: MealExpansionBatch01Word): MealExpansionBindingKind {
  const kinds = new Set(
    frameEntitiesFor(word).flatMap(
      (entity) =>
        entity.lexemeSenseBindings
          ?.filter((binding) => sameLexemeSense(binding.sense, MEAL_SENSE[word]))
          .map((binding) => binding.bindingKind) ?? [],
    ),
  );
  if (kinds.size !== 1) {
    return "NONE";
  }
  return [...kinds][0]!;
}

function containsCupDrinkOnEveryFrame(): boolean {
  return MEAL_FRAMES.every((frame) => {
    const cup = frame.entityBindings.find((entity) => entity.roleId === "DRINK_CONTAINER");
    const drink = frame.entityBindings.find((entity) => entity.roleId === "DRINK");
    return frame.initialFacts.some(
      (fact) =>
        fact.id === `${mealPrefixForFrame(frame.id)}-fact-contains-cup-drink` &&
        fact.predicate === "contains" &&
        fact.arguments[0]?.kind === "ENTITY" &&
        fact.arguments[0].entityId === cup?.entityId &&
        fact.arguments[1]?.kind === "ENTITY" &&
        fact.arguments[1].entityId === drink?.entityId,
    );
  });
}

function supportsPlateFoodOnEveryFrame(): boolean {
  return MEAL_FRAMES.every((frame) => {
    const plate = frame.entityBindings.find((entity) => entity.roleId === "FOOD_SUPPORT");
    const served = frame.entityBindings.find((entity) => entity.roleId === "SUPPORTED_FOOD");
    return frame.initialFacts.some(
      (fact) =>
        fact.id === `${mealPrefixForFrame(frame.id)}-fact-supports-plate-food` &&
        fact.predicate === "supports" &&
        fact.arguments[0]?.kind === "ENTITY" &&
        fact.arguments[0].entityId === plate?.entityId &&
        fact.arguments[1]?.kind === "ENTITY" &&
        fact.arguments[1].entityId === served?.entityId,
    );
  });
}

function factGroundingExists(word: MealExpansionBatch01Word): boolean {
  if (word === "cup" || word === "drink") {
    return containsCupDrinkOnEveryFrame();
  }
  if (word === "plate") {
    return supportsPlateFoodOnEveryFrame();
  }
  return false;
}

export const MEAL_EXPANSION_BATCH_01_ELIGIBILITY: readonly MealExpansionWordEligibility[] = [
  {
    word: "cup",
    bundledLexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.cup),
    canonicalKey: BUNDLED_LEXEME_BINDINGS.cup.canonicalKey,
    exactSenseId: MEAL_SENSE.cup.senseId,
    catalogRole: "DRINK_CONTAINER",
    skeletonRoleExists: true,
    frameBindingExists: true,
    factGroundingExists: true,
    bindingKind: "NAMES_ENTITY",
    probeEligible: true,
    buildEligible: true,
    strengthenEligible: true,
    result: "ELIGIBLE_NOW",
    gap: "",
  },
  {
    word: "drink",
    bundledLexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.drink),
    canonicalKey: BUNDLED_LEXEME_BINDINGS.drink.canonicalKey,
    exactSenseId: MEAL_SENSE.drink.senseId,
    catalogRole: "DRINK",
    skeletonRoleExists: true,
    frameBindingExists: true,
    factGroundingExists: true,
    bindingKind: "NAMES_ENTITY",
    probeEligible: false,
    buildEligible: false,
    strengthenEligible: false,
    result: "SENSE_REVIEW_REQUIRED",
    gap: "Candidate sense drink#consume-liquid names a consume action, while catalog role DRINK, frame entities (Milk/Tea/Juice), and contains(cup, drink) treat a beverage. Bundled gloss merges 喝，饮/饮料. Do not enable Probe/BUILD/STRENGTHEN until noun vs verb senses are split.",
  },
  {
    word: "plate",
    bundledLexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.plate),
    canonicalKey: BUNDLED_LEXEME_BINDINGS.plate.canonicalKey,
    exactSenseId: MEAL_SENSE.plate.senseId,
    catalogRole: "FOOD_SUPPORT",
    skeletonRoleExists: true,
    frameBindingExists: true,
    factGroundingExists: true,
    bindingKind: "NAMES_ENTITY",
    probeEligible: false,
    buildEligible: false,
    strengthenEligible: false,
    result: "REQUIRES_FRAME_CONTENT",
    gap: "Batch 01 does not author plate. Frame role, entity, and supports(plate, served-food) now exist for the separate batch 02 Candidate pack.",
  },
  {
    word: "eat",
    bundledLexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.eat),
    canonicalKey: BUNDLED_LEXEME_BINDINGS.eat.canonicalKey,
    exactSenseId: MEAL_SENSE.eat.senseId,
    catalogRole: "CONSUME_FOOD_ACTION",
    skeletonRoleExists: false,
    frameBindingExists: false,
    factGroundingExists: false,
    bindingKind: "NONE",
    probeEligible: false,
    buildEligible: false,
    strengthenEligible: false,
    result: "REQUIRES_CANDIDATE_SCHEMA",
    gap: "Catalog role CONSUME_FOOD_ACTION is not a skeleton role. ContextualFrameBinding requires entityId; Scene Content has no event/action binding. Domain frame bindings may use NAMES_ACTION, not NAMES_EVENT, and the validator/resolver/BUILD factory still require an entity plus contrast entity. Do not disguise the action as an entity.",
  },
  {
    word: "choose",
    bundledLexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.choose),
    canonicalKey: BUNDLED_LEXEME_BINDINGS.choose.canonicalKey,
    exactSenseId: MEAL_SENSE.choose.senseId,
    catalogRole: "SELECT_ACTION",
    skeletonRoleExists: false,
    frameBindingExists: false,
    factGroundingExists: false,
    bindingKind: "NONE",
    probeEligible: false,
    buildEligible: false,
    strengthenEligible: false,
    result: "REQUIRES_CANDIDATE_SCHEMA",
    gap: "Catalog role SELECT_ACTION is not a skeleton role. CHOOSE_TOOL is a skeleton event definition, not a lexeme binding. ContextualFrameBinding requires entityId. Probe and BUILD present entities. Do not infer an event identity from the choose lemma.",
  },
];

export function eligibilityForExpansionWord(
  word: MealExpansionBatch01Word,
): MealExpansionWordEligibility {
  const row = MEAL_EXPANSION_BATCH_01_ELIGIBILITY.find((item) => item.word === word);
  if (!row) {
    throw new Error(`Missing expansion eligibility for ${word}`);
  }
  return row;
}

export function executableExpansionBatch01Words(): MealExpansionBatch01Word[] {
  return MEAL_EXPANSION_BATCH_01_ELIGIBILITY.filter(
    (item) => item.result === "ELIGIBLE_NOW",
  ).map((item) => item.word);
}

export function liveExpansionEligibilitySignals(word: MealExpansionBatch01Word) {
  const member = catalogMember(word);
  return {
    catalogRole: member?.roleId ?? null,
    skeletonRoleExists: skeletonHasRole(member?.roleId ?? null),
    frameBindingExists: frameBindingExists(word),
    factGroundingExists: factGroundingExists(word),
    bindingKind: bindingKindFor(word),
    exactSenseId: MEAL_SENSE[word].senseId,
    canonicalKey: BUNDLED_LEXEME_BINDINGS[word].canonicalKey,
    bundledLexemeId: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS[word]),
  };
}
