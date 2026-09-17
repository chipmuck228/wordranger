/**
 * Candidate V0 / Experimental / Not a Standard.
 * Compiles the snapshotted current step. Does not skip on failure.
 * Semantic context and targets come only from the run snapshot.
 */

import { compileExperienceStep } from "../compilation/compile-experience-step";
import type { TaskCompilationRequest } from "../compilation/types";
import type { ExperienceStepSpec } from "../domain/types";
import { cloneValue } from "./clone";
import { ExecutionErrorCode, executionError } from "./errors";
import type {
  ExperiencePlanSnapshot,
  ExperienceRun,
  ExperienceRunResult,
} from "./types";

export interface IssueCurrentStepInput {
  run: ExperienceRun;
  now?: string;
  createId?: () => string;
}

export function issueCurrentStep(input: IssueCurrentStepInput): ExperienceRunResult {
  const { run } = input;
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

  const compilationRequest = compilationRequestFromSnapshot({
    run,
    snapshotStep,
    now: input.now,
    createId: input.createId,
  });
  if (!compilationRequest) {
    return {
      ok: false,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        "Current step targets are missing from the resolved snapshot",
        "planSnapshot.resolvedTargets",
      ),
    };
  }

  const now = input.now ?? "2026-09-17T12:00:00.000Z";
  const compiled = compileExperienceStep(compilationRequest);

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
    answerKey: compiled.value.answerKey,
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

function compilationRequestFromSnapshot(input: {
  run: ExperienceRun;
  snapshotStep: ExperienceStepSpec;
  now?: string;
  createId?: () => string;
}): TaskCompilationRequest | null {
  const resolvedTargets = targetsForStep(input.run.planSnapshot, input.snapshotStep);
  if (!resolvedTargets) {
    return null;
  }
  return {
    experienceId: input.run.experienceId,
    learningNeedId: input.run.planSnapshot.plan.sourceLearningNeedRef,
    step: cloneValue(input.snapshotStep),
    resolvedContext: cloneValue(input.run.planSnapshot.resolvedContext),
    resolvedTargets,
    supportPolicy: cloneValue(input.snapshotStep.supportPolicy),
    now: input.now,
    createId: input.createId,
  };
}

function targetsForStep(
  snapshot: ExperiencePlanSnapshot,
  step: ExperienceStepSpec,
) {
  const selected = [];
  for (const targetId of step.targetIds) {
    const target = snapshot.resolvedTargets.find((item) => item.targetId === targetId);
    if (!target) {
      return null;
    }
    selected.push(cloneValue(target));
  }
  return selected;
}
