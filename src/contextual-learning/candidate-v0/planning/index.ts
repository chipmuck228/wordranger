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
  listPlanVariants,
} from "./plan-variant-registry";
export type { ExperiencePlanningError } from "./errors";
export type { PlanExperienceOptions } from "./plan-experience";
export type {
  ExperiencePlanVariant,
  ExperiencePlanningInput,
  ExperiencePlanningResult,
  ExperiencePlanningTrace,
  PlanExecutability,
  RejectedTargetRequirement,
} from "./types";
