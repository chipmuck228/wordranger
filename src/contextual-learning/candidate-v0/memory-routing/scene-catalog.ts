/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Reviewed scene membership for current three-case fixture words only.
 */

import { MEAL_SENSE } from "../fixtures/meal/knowledge";
import { SCHOOL_SENSE } from "../fixtures/school-challenge/knowledge";
import { BORROW_SENSE } from "../fixtures/borrowing-sharing/knowledge";
import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "./bundled-lexeme-bindings";
import {
  BORROW_SCENE_ROLE_IDS,
  MEAL_SCENE_ROLE_IDS,
  SCHOOL_SCENE_ROLE_IDS,
} from "./scene-roles";
import {
  SCENE_VOCABULARY_CATALOG_VERSION,
  type SceneVocabularyCluster,
  type SceneVocabularyMember,
} from "./types";

type BindingKey = keyof typeof BUNDLED_LEXEME_BINDINGS;

function member(
  key: BindingKey,
  senseId: string,
  roleId: string,
  roleDescription: string,
  extras: Partial<
    Pick<
      SceneVocabularyMember,
      "learningPriority" | "perspectiveId"
    >
  > = {},
): SceneVocabularyMember {
  const binding = BUNDLED_LEXEME_BINDINGS[key];
  return {
    target: { lexemeId: bundledBindingLexemeId(binding), senseId },
    lexemeCanonicalKey: binding.canonicalKey,
    roleId,
    roleDescription,
    candidateFixtureLexemeId: binding.fixtureLexemeId,
    ...extras,
  };
}

export const MEAL_SCENE_CLUSTER: SceneVocabularyCluster = {
  id: "meal-scene-v0",
  version: SCENE_VOCABULARY_CATALOG_VERSION,
  title: "Meal",
  semanticScope: "Eating tools, foods, containers, and consume/select actions in a meal setting",
  allowedRoleIds: MEAL_SCENE_ROLE_IDS,
  members: [
    member(
      "spoon",
      MEAL_SENSE.spoon.senseId,
      "EATING_TOOL",
      "Utensil used to move liquid or soft food to the mouth",
      { learningPriority: "PRIMARY" },
    ),
    member(
      "fork",
      MEAL_SENSE.fork.senseId,
      "EATING_TOOL",
      "Utensil contrasted with spoon for piercing solid food",
      { learningPriority: "CONTRAST" },
    ),
    member(
      "bowl",
      MEAL_SENSE.bowl.senseId,
      "FOOD_CONTAINER",
      "Container that holds liquid or loose food",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "plate",
      MEAL_SENSE.plate.senseId,
      "FOOD_SUPPORT",
      "Support surface for solid food, contrasted with a bowl",
      { learningPriority: "CONTRAST" },
    ),
    member(
      "cup",
      MEAL_SENSE.cup.senseId,
      "DRINK_CONTAINER",
      "Container that holds a drink",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "soup",
      MEAL_SENSE.soup.senseId,
      "FOOD",
      "Liquid food that selects for a spoon",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "eat",
      MEAL_SENSE.eat.senseId,
      "CONSUME_FOOD_ACTION",
      "Action of consuming food",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "drink",
      MEAL_SENSE.drink.senseId,
      "DRINK",
      "Beverage present at the meal; not inferred from the eat lemma",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "choose",
      MEAL_SENSE.choose.senseId,
      "SELECT_ACTION",
      "Action of selecting a suitable tool",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "knife",
      MEAL_SENSE.knife.senseId,
      "EATING_TOOL",
      "Utensil used to cut solid food, contrasted with spoon and fork",
      { learningPriority: "CONTRAST" },
    ),
    member(
      "bread",
      MEAL_SENSE.bread.senseId,
      "SOLID_FOOD",
      "Solid food that can be cut, contrasted with soup",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "water",
      MEAL_SENSE.water.senseId,
      "DRINKABLE_LIQUID",
      "Drinkable liquid at the table, contrasted with soup",
      { learningPriority: "SUPPORTING" },
    ),
  ],
};

export const MEAL_UTENSIL_CONTRAST_CLUSTER: SceneVocabularyCluster = {
  id: "meal-utensil-contrast-v0",
  version: SCENE_VOCABULARY_CATALOG_VERSION,
  title: "Meal utensil contrast",
  semanticScope: "The same spoon/fork senses, reusable in a contrast-focused cluster",
  allowedRoleIds: MEAL_SCENE_ROLE_IDS,
  members: [
    member(
      "spoon",
      MEAL_SENSE.spoon.senseId,
      "EATING_TOOL",
      "Same spoon sense as the meal cluster; cross-cluster membership is allowed",
      { learningPriority: "PRIMARY" },
    ),
    member(
      "fork",
      MEAL_SENSE.fork.senseId,
      "EATING_TOOL",
      "Same fork sense as the meal cluster",
      { learningPriority: "CONTRAST" },
    ),
  ],
};

export const SCHOOL_CHALLENGE_SCENE_CLUSTER: SceneVocabularyCluster = {
  id: "school-challenge-scene-v0",
  version: SCENE_VOCABULARY_CATALOG_VERSION,
  title: "School Challenge",
  semanticScope:
    "Skill-scoped capacity, goal reachability, difficulty, attempt, strategy, and local outcome",
  allowedRoleIds: SCHOOL_SCENE_ROLE_IDS,
  members: [
    member(
      "ability",
      SCHOOL_SENSE.ability.senseId,
      "CAPACITY_PROPERTY",
      "Current capacity relative to one skill, not a global trait",
      { learningPriority: "PRIMARY" },
    ),
    member(
      "possible",
      SCHOOL_SENSE.possible.senseId,
      "GOAL_REACHABILITY_JUDGMENT",
      "Whether a specific goal is reachable",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "difficult",
      SCHOOL_SENSE.difficult.senseId,
      "REQUIREMENT_JUDGMENT",
      "Whether a specific challenge has a high requirement",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "challenge",
      SCHOOL_SENSE.challenge.senseId,
      "CHALLENGE",
      "The goal-task being attempted",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "try",
      SCHOOL_SENSE.try.senseId,
      "ATTEMPT",
      "An effort toward a goal, not the same as success",
      { learningPriority: "PRIMARY" },
    ),
    member(
      "improve",
      SCHOOL_SENSE.improve.senseId,
      "STATE_CHANGE",
      "A later attempt changes state; not general ability",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "practice",
      SCHOOL_SENSE.practice.senseId,
      "REPEATED_ATTEMPT",
      "Repeated attempt used as strategy",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "plan",
      SCHOOL_SENSE.plan.senseId,
      "STRATEGY",
      "A strategy for the challenge",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "success",
      SCHOOL_SENSE.success.senseId,
      "OUTCOME",
      "Local goal satisfaction, not general ability",
      { learningPriority: "PRIMARY" },
    ),
    member(
      "result",
      SCHOOL_SENSE.result.senseId,
      "OUTCOME",
      "The outcome of the attempt",
      { learningPriority: "SUPPORTING" },
    ),
  ],
};

export const BORROWING_SHARING_SCENE_CLUSTER: SceneVocabularyCluster = {
  id: "borrowing-sharing-scene-v0",
  version: SCENE_VOCABULARY_CATALOG_VERSION,
  title: "Borrowing-Sharing",
  semanticScope:
    "Temporary access versus ownership transfer; borrow and lend keep opposite perspectives",
  allowedRoleIds: BORROW_SCENE_ROLE_IDS,
  members: [
    member(
      "borrow",
      BORROW_SENSE.borrow.senseId,
      "TEMPORARY_RECEIVE",
      "Requester perspective: temporary receive; ownership stays put",
      { learningPriority: "PRIMARY", perspectiveId: "REQUESTER" },
    ),
    member(
      "lend",
      BORROW_SENSE.lend.senseId,
      "TEMPORARY_PROVIDE",
      "Owner perspective: temporary provide; same event as borrow, opposite observer",
      { learningPriority: "PRIMARY", perspectiveId: "OWNER" },
    ),
    member(
      "share",
      BORROW_SENSE.share.senseId,
      "JOINT_ACCESS",
      "Joint access without treating borrow and lend as the same lemma",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "give",
      BORROW_SENSE.give.senseId,
      "TRANSFER_OWNERSHIP",
      "Ownership transfer, contrasted with temporary borrow",
      { learningPriority: "CONTRAST" },
    ),
    member(
      "take",
      BORROW_SENSE.take.senseId,
      "GAIN_CONTROL",
      "Gaining control, not the same as borrow",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "return",
      BORROW_SENSE.return.senseId,
      "RESTORE_POSSESSION",
      "Restore possession to the owner",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "ask",
      BORROW_SENSE.ask.senseId,
      "REQUEST_ACCESS",
      "Request access from the owner",
      { learningPriority: "SUPPORTING" },
    ),
    member(
      "accept",
      BORROW_SENSE.accept.senseId,
      "ALLOW_ACCESS",
      "Owner allows temporary access",
      { learningPriority: "SUPPORTING", perspectiveId: "OWNER" },
    ),
    member(
      "refuse",
      BORROW_SENSE.refuse.senseId,
      "DENY_ACCESS",
      "Owner denies access",
      { learningPriority: "SUPPORTING", perspectiveId: "OWNER" },
    ),
    member(
      "own",
      BORROW_SENSE.own.senseId,
      "OWNERSHIP",
      "Ownership relation that does not change on borrow",
      { learningPriority: "SUPPORTING", perspectiveId: "OWNER" },
    ),
    member(
      "use",
      BORROW_SENSE.use.senseId,
      "ACCESS",
      "Access/use while holding temporarily",
      { learningPriority: "SUPPORTING", perspectiveId: "REQUESTER" },
    ),
  ],
};

export const SCENE_VOCABULARY_CLUSTERS: readonly SceneVocabularyCluster[] = [
  MEAL_SCENE_CLUSTER,
  MEAL_UTENSIL_CONTRAST_CLUSTER,
  SCHOOL_CHALLENGE_SCENE_CLUSTER,
  BORROWING_SHARING_SCENE_CLUSTER,
];
