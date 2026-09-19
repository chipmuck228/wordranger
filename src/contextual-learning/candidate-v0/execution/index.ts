/**
 * Contextual Learning Experience Execution Protocol Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Sequences ExperiencePlan steps. Does not grade, create Evidence,
 * or update StudentLexemeModel.
 */

export { abortExperienceRun } from "./abort-experience-run";
export { classifyExperienceStep } from "./classify-step";
export { createExperienceRun } from "./create-experience-run";
export { ExecutionErrorCode } from "./errors";
export {
  createPublicGuidedActivity,
  guidedActivityId,
} from "./guided-activity";
export { issueCurrentStep } from "./issue-current-step";
export { recordGuidedActivityCompletion } from "./record-guided-activity-completion";
export {
  recordFrozenTaskCompletion,
  recordTaskCompletion,
} from "./record-task-completion";
export { applyExperienceCommand } from "./transition-experience-run";
export { validateExperienceRun } from "./validate-experience-run";
export type {
  StepExecutionClassification,
} from "./classify-step";
export type {
  ExperienceExecutionError,
} from "./errors";
export type {
  GuidedActivityCompletionReceipt,
  PublicGuidedActivity,
} from "./guided-activity";
export type {
  ExperiencePlanSnapshot,
  ExperienceRun,
  ExperienceRunCommand,
  ExperienceRunResult,
  ExperienceStepRun,
  FrozenTaskCompletionReceipt,
} from "./types";
