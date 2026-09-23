/**
 * Candidate V0 / Experimental / Not a Standard.
 * Shared linear advance after a recorded completion. Does not interpret correctness.
 */

import { cloneValue } from "./clone";
import { ExecutionErrorCode, executionError } from "./errors";
import type { ExperienceRun, ExperienceRunResult, ExperienceStepRun } from "./types";

export function applyRecordedStepCompletion(input: {
  run: ExperienceRun;
  completedRuns: ExperienceStepRun[];
  now: string;
}): ExperienceRunResult {
  const { run, completedRuns, now } = input;
  const snapshotStep = run.planSnapshot.plan.steps[run.currentStepIndex];
  if (!snapshotStep) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        "currentStepIndex does not point at a snapshotted step",
        "run.currentStepIndex",
      ),
    };
  }
  const acceptedRun = {
    ...cloneValue(run),
    updatedAt: now,
    stepRuns: completedRuns,
  };
  const nextIndex = run.currentStepIndex + 1;
  const hasNext = nextIndex < run.planSnapshot.plan.steps.length;
  const isTerminal = run.planSnapshot.plan.completionPolicy.terminalStepIds.includes(
    snapshotStep.id,
  );
  const requiredSatisfied =
    run.planSnapshot.plan.completionPolicy.requiredStepIds.every((stepId) =>
      completedRuns.some(
        (stepRun) =>
          stepRun.stepId === stepId && stepRun.status === "STEP_COMPLETED",
      ),
    );
  const wantsEnd =
    snapshotStep.transition.onTaskCompleted === "END" || isTerminal;

  if (wantsEnd && requiredSatisfied) {
    return {
      ok: true,
      run: {
        ...acceptedRun,
        status: "COMPLETED",
      },
    };
  }

  if (hasNext && snapshotStep.transition.onTaskCompleted === "NEXT" && !wantsEnd) {
    return {
      ok: true,
      run: {
        ...acceptedRun,
        status: "READY",
        currentStepIndex: nextIndex,
      },
    };
  }

  if (wantsEnd && !requiredSatisfied) {
    return {
      ok: false,
      run: {
        ...acceptedRun,
        status: "BLOCKED",
      },
      error: executionError(
        ExecutionErrorCode.EXEC_TERMINAL_POLICY_NOT_SATISFIED,
        "Terminal completion is not allowed until required steps are completed",
        "plan.completionPolicy",
      ),
    };
  }

  return {
    ok: false,
    run: {
      ...acceptedRun,
      status: "BLOCKED",
    },
    error: executionError(
      ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
      "Completed step has no legal next or terminal transition",
      "step.transition",
    ),
  };
}
