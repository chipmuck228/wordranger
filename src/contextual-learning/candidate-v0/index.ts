/**
 * Contextual Learning Domain Model Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * This module is not part of the stable WordRanger public API.
 * It plans contextual experiences. It does not grade and does not
 * update StudentLexemeModel.
 */

export { DomainErrorCode } from "./domain/errors";
export type {
  DomainValidationIssue,
  DomainValidationResult,
} from "./domain/errors";
export type {
  CognitiveMode,
  ContextFrame,
  ExperienceStepSpec,
  LearningExperiencePlan,
  LexemeSenseRef,
  RuntimeCapability,
  SemanticSkeleton,
} from "./domain/types";
export { sameLexemeSense, lexemeSenseKey } from "./domain/lexeme-sense";

export { validateSemanticSkeleton } from "./validation/validate-semantic-skeleton";
export { validateContextFrame } from "./validation/validate-context-frame";
export { validateExperiencePlan } from "./validation/validate-experience-plan";
export { resolveContextSnapshot } from "./validation/resolve-context";

export {
  FROZEN_RUNTIME_CAPABILITIES,
  FROZEN_RUNTIME_GAPS,
  findResponseTransport,
  listFrozenRuntimeCapabilities,
} from "./capabilities/capability-registry";
export {
  SEMANTIC_PROJECTION_WHITELIST,
  findSemanticProjection,
} from "./compilation/semantic-projection";

export { compileExperienceStep } from "./compilation/compile-experience-step";
export type {
  CompileResult,
  TaskCompilationRequest,
  TaskCompilationResult,
} from "./compilation/types";

export { mealSkeleton } from "./fixtures/meal/skeleton";
export { MEAL_FRAMES } from "./fixtures/meal/contexts";
export {
  createMealBuildPlan,
  createMealStrengthenPlan,
} from "./fixtures/meal/plans";

export { schoolChallengeSkeleton } from "./fixtures/school-challenge/skeleton";
export { SCHOOL_FRAMES } from "./fixtures/school-challenge/contexts";
export {
  createSchoolBuildPlan,
  createSchoolStrengthenPlan,
} from "./fixtures/school-challenge/plans";

export { borrowingSharingSkeleton } from "./fixtures/borrowing-sharing/skeleton";
export { BORROW_FRAMES } from "./fixtures/borrowing-sharing/contexts";
export {
  createBorrowBuildPlan,
  createBorrowStrengthenPlan,
  createUnsupportedOrderStep,
} from "./fixtures/borrowing-sharing/plans";
