/**
 * Candidate V0 / Experimental / Not a Standard.
 * Compiles the snapshotted current step. Does not skip on failure.
 */

import { compileExperienceStep } from "../compilation/compile-experience-step";
import type { TaskCompilationRequest } from "../compilation/types";
import { cloneValue } from "./clone";
import { ExecutionErrorCode, executionError } from "./errors";
import { matchCompilationRequestToSnapshot } from "./match-compilation-request";
import type { ExperienceRun, ExperienceRunResult } from "./types";

export interface IssueCurrentStepInput {
  run: ExperienceRun;
  compilationRequest: TaskCompilationRequest;
  now?: string;
}

export function issueCurrentStep(input: IssueCurrentStepInput): ExperienceRunResult {
  const { run, compilationRequest } = input;
  if (run.status === "BLOCKED") {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_CURRENT_STEP_BLOCKED,
        "Blocked experience run cannot issue another step",
        "run.status",
      ),
    };
  }
  if (run.status !== "READY") {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Cannot issue a step while run is ${run.status}`,
        "run.status",
      ),
    };
  }

  const snapshotStep = run.planSnapshot.plan.steps[run.currentStepIndex];
  const currentStepRun = run.stepRuns[run.currentStepIndex];
  if (!snapshotStep || !currentStepRun) {
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
  if (currentStepRun.status !== "PENDING") {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Current step ${currentStepRun.stepId} is ${currentStepRun.status}`,
        "stepRuns",
      ),
    };
  }

  const mismatch = matchCompilationRequestToSnapshot({
    plan: run.planSnapshot.plan,
    snapshotStep,
    experienceId: run.experienceId,
    compilationRequest,
  });
  if (mismatch) {
    return { ok: false, run, error: mismatch };
  }

  const now = input.now ?? "2026-09-17T12:00:00.000Z";
  const compiled = compileExperienceStep({
    ...compilationRequest,
    step: snapshotStep,
    supportPolicy: snapshotStep.supportPolicy,
    experienceId: run.experienceId,
  });

  if (!compiled.ok) {
    return {
      ok: false,
      run: {
        ...cloneValue(run),
        status: "BLOCKED",
        updatedAt: now,
        stepRuns: run.stepRuns.map((stepRun, index) =>
          index === run.currentStepIndex
            ? {
                ...stepRun,
                status: "COMPILATION_FAILED",
                compilationError: compiled.error,
              }
            : { ...stepRun },
        ),
      },
      error: executionError(
        compiled.error.code,
        compiled.error.message,
        compiled.error.path,
      ),
    };
  }

  return {
    ok: true,
    issuedTask: compiled.value.publicLearningTask,
    run: {
      ...cloneValue(run),
      status: "TASK_ISSUED",
      updatedAt: now,
      stepRuns: run.stepRuns.map((stepRun, index) =>
        index === run.currentStepIndex
          ? {
              ...stepRun,
              status: "TASK_ISSUED",
              taskId: compiled.value.publicLearningTask.id,
              compilationTrace: compiled.value.trace,
              issuedAt: now,
            }
          : { ...stepRun },
      ),
    },
  };
}
