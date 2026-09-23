/**
 * Contextual Learning Experience Planner Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Not part of the stable WordRanger public API.
 */

export { PlanningErrorCode } from "./errors";
export { idsCovered, matchRequestedTargetsToPlan } from "./match-targets";
export { planExperience } from "./plan-experience";
export {
  comparePlanVariants,
  findPlannerFrame,
  findPlannerSkeleton,
  listPlanVariants,
} from "./plan-variant-registry";
export {
  experimentalMealRuntimeContextId,
  mealRuntimeContextIdForPack,
  packForMealRuntime,
} from "./meal-runtime-context";
export type { MealRuntimeContextId } from "./meal-runtime-context";
export type { ExperiencePlanningError } from "./errors";
export type { PlanExperienceOptions } from "./plan-experience";
export type {
  ExperiencePlanVariant,
  ExperiencePlanningInput,
  ExperiencePlanningResult,
  ExperiencePlanningTrace,
  PlanExecutability,
  PlannerAuthoredRuntime,
  RejectedTargetRequirement,
} from "./types";
