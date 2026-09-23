/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Structured scene roles. Not free-text inference.
 */

export const MEAL_SCENE_ROLE_IDS = [
  "EATING_TOOL",
  "FOOD",
  "FOOD_CONTAINER",
  "FOOD_SUPPORT",
  "DRINK",
  "DRINK_CONTAINER",
  "CONSUME_FOOD_ACTION",
  "SELECT_ACTION",
  "SOLID_FOOD",
  "DRINKABLE_LIQUID",
] as const;

export const SCHOOL_SCENE_ROLE_IDS = [
  "CAPACITY_PROPERTY",
  "GOAL_REACHABILITY_JUDGMENT",
  "REQUIREMENT_JUDGMENT",
  "CHALLENGE",
  "ATTEMPT",
  "STATE_CHANGE",
  "REPEATED_ATTEMPT",
  "STRATEGY",
  "OUTCOME",
] as const;

export const BORROW_SCENE_ROLE_IDS = [
  "TEMPORARY_RECEIVE",
  "TEMPORARY_PROVIDE",
  "JOINT_ACCESS",
  "TRANSFER_OWNERSHIP",
  "GAIN_CONTROL",
  "RESTORE_POSSESSION",
  "REQUEST_ACCESS",
  "ALLOW_ACCESS",
  "DENY_ACCESS",
  "OWNERSHIP",
  "ACCESS",
] as const;
