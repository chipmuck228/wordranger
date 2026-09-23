/**
 * Candidate V0 / Experimental / Not a Standard.
 * Records that an issued frozen task finished. Does not interpret correctness.
 */

import { applyRecordedStepCompletion } from "./apply-step-completion";
import { ExecutionErrorCode, executionError } from "./errors";
import type {
  ExperienceRun,
  ExperienceRunResult,
  FrozenTaskCompletionReceipt,
} from "./types";

export interface RecordFrozenTaskCompletionInput {
  run: ExperienceRun;
  receipt: FrozenTaskCompletionReceipt;
  now?: string;
}

export function recordFrozenTaskCompletion(
  input: RecordFrozenTaskCompletionInput,
): ExperienceRunResult {
  const { run, receipt } = input;
  if (
    run.stepRuns.some(
      (stepRun) =>
        stepRun.taskId === receipt.taskId && stepRun.status === "STEP_COMPLETED",
    )
  ) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_DUPLICATE_COMPLETION,
        `Task ${receipt.taskId} was already recorded as completed`,
        "receipt.taskId",
      ),
    };
  }

  if (run.status === "GUIDED_ACTIVITY_ISSUED") {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_RECEIPT_KIND_MISMATCH,
        "A frozen-task receipt cannot complete a guided activity",
        "receipt",
      ),
    };
  }

  if (run.status !== "FROZEN_TASK_ISSUED") {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Cannot record frozen-task completion while run is ${run.status}`,
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
  if (current.status !== "FROZEN_TASK_ISSUED" || !current.taskId) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Current step ${current.stepId} is not awaiting a frozen-task receipt`,
        "stepRuns",
      ),
    };
  }
  if (receipt.taskId !== current.taskId) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_TASK_ID_MISMATCH,
        `Receipt taskId ${receipt.taskId} does not match issued task ${current.taskId}`,
        "receipt.taskId",
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

/** @deprecated Use recordFrozenTaskCompletion. */
export const recordTaskCompletion = recordFrozenTaskCompletion;
