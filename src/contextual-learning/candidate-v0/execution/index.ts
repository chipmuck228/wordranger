/**
 * Contextual Learning Experience Execution Protocol Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Sequences ExperiencePlan steps. Does not grade, create Evidence,
 * or update StudentLexemeModel.
 */

export { abortExperienceRun } from "./abort-experience-run";
export { createExperienceRun } from "./create-experience-run";
export { ExecutionErrorCode } from "./errors";
export { issueCurrentStep } from "./issue-current-step";
export { recordTaskCompletion } from "./record-task-completion";
export { applyExperienceCommand } from "./transition-experience-run";
export { validateExperienceRun } from "./validate-experience-run";
export type {
  ExperienceExecutionError,
} from "./errors";
export type {
  ExperiencePlanSnapshot,
  ExperienceRun,
  ExperienceRunCommand,
  ExperienceRunResult,
  ExperienceStepRun,
  FrozenTaskCompletionReceipt,
} from "./types";
