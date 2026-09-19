/**
 * Candidate V0 / Experimental / Not a Standard.
 * Issues the current snapshotted step as a frozen task or guided activity.
 */

import { compileExperienceStep } from "../compilation/compile-experience-step";
import type { TaskCompilationRequest } from "../compilation/types";
import {
  isAssessableExperienceStep,
  isGuidedExperienceStep,
  type AssessableExperienceStepSpec,
  type ExperienceStepSpec,
} from "../domain/types";
import { classifyExperienceStep } from "./classify-step";
import { cloneValue } from "./clone";
import { ExecutionErrorCode, executionError } from "./errors";
import { createPublicGuidedActivity } from "./guided-activity";
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

  const now = input.now ?? "2026-09-17T12:00:00.000Z";
  const classification = classifyExperienceStep({
    step: snapshotStep,
    resolvedTargets: targetsForStep(run.planSnapshot, snapshotStep) ?? [],
  });

  if (classification.kind === "GUIDED_ACTIVITY") {
    if (!isGuidedExperienceStep(snapshotStep)) {
      return {
        ok: false,
        run,
        classification,
        error: executionError(
          ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
          "Guided classification requires a guided step spec",
          "executionIntent",
        ),
      };
    }
    const issuedActivity = createPublicGuidedActivity({
      experienceId: run.experienceId,
      contextFrameId: run.planSnapshot.resolvedContext.contextFrameId,
      step: snapshotStep,
    });
    return {
      ok: true,
      issuedActivity,
      classification,
      run: {
        ...cloneValue(run),
        status: "GUIDED_ACTIVITY_ISSUED",
        updatedAt: now,
        stepRuns: run.stepRuns.map((stepRun, index) =>
          index === run.currentStepIndex
            ? {
                ...stepRun,
                status: "GUIDED_ACTIVITY_ISSUED",
                classification,
                activityId: issuedActivity.id,
                issuedAt: now,
              }
            : { ...stepRun },
        ),
      },
    };
  }

  if (classification.kind === "UNSUPPORTED") {
    return {
      ok: false,
      classification,
      run: {
        ...cloneValue(run),
        status: "BLOCKED",
        updatedAt: now,
        stepRuns: run.stepRuns.map((stepRun, index) =>
          index === run.currentStepIndex
            ? {
                ...stepRun,
                status: "BLOCKED",
                classification,
                compilationError: {
                  code: classification.reasonCode,
                  message: classification.rationale,
                  path: "step",
                },
              }
            : { ...stepRun },
        ),
      },
      error: executionError(
        classification.reasonCode,
        classification.rationale,
        "step",
      ),
    };
  }

  if (!isAssessableExperienceStep(snapshotStep)) {
    return {
      ok: false,
      classification,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        "Assessable classification requires an assessable step spec",
        "executionIntent",
      ),
    };
  }

  const compilationRequest = compilationRequestFromSnapshot({
    run,
    snapshotStep,
    now,
    createId: input.createId,
  });
  if (!compilationRequest) {
    return {
      ok: false,
      classification,
      run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        "Current step targets are missing from the resolved snapshot",
        "planSnapshot.resolvedTargets",
      ),
    };
  }

  const compiled = compileExperienceStep(compilationRequest);
  if (!compiled.ok) {
    return {
      ok: false,
      classification,
      run: {
        ...cloneValue(run),
        status: "BLOCKED",
        updatedAt: now,
        stepRuns: run.stepRuns.map((stepRun, index) =>
          index === run.currentStepIndex
            ? {
                ...stepRun,
                status: "COMPILATION_FAILED",
                classification,
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
    classification,
    run: {
      ...cloneValue(run),
      status: "FROZEN_TASK_ISSUED",
      updatedAt: now,
      stepRuns: run.stepRuns.map((stepRun, index) =>
        index === run.currentStepIndex
          ? {
              ...stepRun,
              status: "FROZEN_TASK_ISSUED",
              classification,
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
  snapshotStep: AssessableExperienceStepSpec;
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
