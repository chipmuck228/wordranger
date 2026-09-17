/**
 * Candidate V0 / Experimental / Not a Standard.
 * Records that an issued frozen task finished. Does not interpret correctness.
 */

import { cloneValue } from "./clone";
import { ExecutionErrorCode, executionError } from "./errors";
import type {
  ExperienceRun,
  ExperienceRunResult,
  FrozenTaskCompletionReceipt,
} from "./types";

export interface RecordTaskCompletionInput {
  run: ExperienceRun;
  receipt: FrozenTaskCompletionReceipt;
  now?: string;
}

export function recordTaskCompletion(
  input: RecordTaskCompletionInput,
): ExperienceRunResult {
  const { run, receipt } = input;
  if (
    run.stepRuns.some(
      (stepRun) =>
        stepRun.taskId === receipt.taskId && stepRun.status === "TASK_COMPLETED",
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

  if (run.status !== "TASK_ISSUED") {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Cannot record completion while run is ${run.status}`,
        "run.status",
      ),
    };
  }

  const current = run.stepRuns[run.currentStepIndex];
  const snapshotStep = run.planSnapshot.plan.steps[run.currentStepIndex];
  if (!current || !snapshotStep) {
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
  if (current.status !== "TASK_ISSUED" || !current.taskId) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Current step ${current.stepId} is not awaiting completion`,
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
          status: "TASK_COMPLETED" as const,
          completedAt: receipt.completedAt,
        }
      : { ...stepRun },
  );
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
          stepRun.stepId === stepId && stepRun.status === "TASK_COMPLETED",
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
