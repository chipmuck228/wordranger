/**
 * Candidate V0 / Experimental / Not a Standard.
 * Planner outcomes. Ordinary “no compatible plan” is a result, not a throw.
 */

export const PlanningErrorCode = {
  PLAN_MISSING_LEARNING_NEED_REF: "PLAN_MISSING_LEARNING_NEED_REF",
  PLAN_NO_TARGETS: "PLAN_NO_TARGETS",
  PLAN_TARGET_NOT_REGISTERED: "PLAN_TARGET_NOT_REGISTERED",
  PLAN_NO_ALLOWED_CONTEXT: "PLAN_NO_ALLOWED_CONTEXT",
  PLAN_MODE_NOT_AVAILABLE: "PLAN_MODE_NOT_AVAILABLE",
  PLAN_NO_COMPATIBLE_VARIANT: "PLAN_NO_COMPATIBLE_VARIANT",
  PLAN_MISSING_RUNTIME_CAPABILITY: "PLAN_MISSING_RUNTIME_CAPABILITY",
  PLAN_VARIANT_INVALID: "PLAN_VARIANT_INVALID",
  PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE: "PLAN_GUIDED_ONLY_CANNOT_VERIFY_MODE",
} as const;

export type PlanningErrorCode =
  (typeof PlanningErrorCode)[keyof typeof PlanningErrorCode];

export interface ExperiencePlanningError {
  code: PlanningErrorCode;
  message: string;
  path: string;
}

export function planningError(
  code: PlanningErrorCode,
  message: string,
  path = "input",
): ExperiencePlanningError {
  return { code, message, path };
}
