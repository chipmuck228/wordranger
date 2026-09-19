/**
 * Candidate V0 / Experimental / Not a Standard.
 * Records that a guided activity was acknowledged. Does not mean learning success.
 */

import { applyRecordedStepCompletion } from "./apply-step-completion";
import { ExecutionErrorCode, executionError } from "./errors";
import type { GuidedActivityCompletionReceipt } from "./guided-activity";
import type { ExperienceRun, ExperienceRunResult } from "./types";

export interface RecordGuidedActivityCompletionInput {
  run: ExperienceRun;
  receipt: GuidedActivityCompletionReceipt;
  now?: string;
}

export function recordGuidedActivityCompletion(
  input: RecordGuidedActivityCompletionInput,
): ExperienceRunResult {
  const { run, receipt } = input;
  if (
    run.stepRuns.some(
      (stepRun) =>
        stepRun.activityId === receipt.activityId &&
        stepRun.status === "STEP_COMPLETED",
    )
  ) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_DUPLICATE_COMPLETION,
        `Guided activity ${receipt.activityId} was already recorded as completed`,
        "receipt.activityId",
      ),
    };
  }

  if (run.status === "FROZEN_TASK_ISSUED") {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_RECEIPT_KIND_MISMATCH,
        "A guided-activity receipt cannot complete a frozen task",
        "receipt",
      ),
    };
  }

  if (run.status !== "GUIDED_ACTIVITY_ISSUED") {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Cannot record guided-activity completion while run is ${run.status}`,
        "run.status",
      ),
    };
  }

  const current = run.stepRuns[run.currentStepIndex];
  if (!current) {
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
  if (current.status !== "GUIDED_ACTIVITY_ISSUED" || !current.activityId) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Current step ${current.stepId} is not awaiting a guided-activity receipt`,
        "stepRuns",
      ),
    };
  }
  if (receipt.activityId !== current.activityId) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_ACTIVITY_ID_MISMATCH,
        `Receipt activityId ${receipt.activityId} does not match issued activity ${current.activityId}`,
        "receipt.activityId",
      ),
    };
  }

  const now = input.now ?? receipt.completedAt;
  const completedRuns = run.stepRuns.map((stepRun, index) =>
    index === run.currentStepIndex
      ? {
          ...stepRun,
          status: "STEP_COMPLETED" as const,
          completedAt: receipt.completedAt,
        }
      : { ...stepRun },
  );
  return applyRecordedStepCompletion({ run, completedRuns, now });
}
