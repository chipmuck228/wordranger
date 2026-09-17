/**
 * Candidate V0 / Experimental / Not a Standard.
 */

import { ExecutionErrorCode, executionError } from "./errors";
import type { ExperienceRun } from "./types";
import { validateResolvedSnapshotAgainstPlan } from "./validate-resolved-snapshot";

export function validateExperienceRun(run: ExperienceRun) {
  const plan = run.planSnapshot.plan;
  const resolvedError = validateResolvedSnapshotAgainstPlan(run.planSnapshot);
  if (resolvedError) {
    return resolvedError;
  }
  if (run.schemaVersion !== "candidate-v0") {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "ExperienceRun schemaVersion must be candidate-v0",
      "schemaVersion",
    );
  }
  if (run.experienceId !== plan.id) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "ExperienceRun.experienceId must match the snapshotted plan",
      "experienceId",
    );
  }
  if (run.stepRuns.length !== plan.steps.length) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "stepRuns must correspond 1:1 with plan.steps",
      "stepRuns",
    );
  }
  for (const [index, step] of plan.steps.entries()) {
    if (run.stepRuns[index]?.stepId !== step.id) {
      return executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        `stepRuns[${index}] does not match plan.steps[${index}]`,
        "stepRuns",
      );
    }
  }
  if (
    run.currentStepIndex < 0 ||
    run.currentStepIndex >= plan.steps.length
  ) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "currentStepIndex is out of range",
      "currentStepIndex",
    );
  }
  return null;
}
