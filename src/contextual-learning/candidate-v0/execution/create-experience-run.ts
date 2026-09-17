/**
 * Candidate V0 / Experimental / Not a Standard.
 */

import type { LearningExperiencePlan } from "../domain/types";
import { cloneValue } from "./clone";
import { ExecutionErrorCode, executionError } from "./errors";
import type { ExperienceRun, ExperienceRunResult, ExperienceStepRun } from "./types";
import { validateExperienceRun } from "./validate-experience-run";

const LEARNER_MUTATION_KEYS = [
  "updateLearnerState",
  "writeEvidence",
  "mutateModel",
  "studentLexemeModel",
  "processEvidence",
] as const;

export interface CreateExperienceRunInput {
  plan: LearningExperiencePlan;
  now?: string;
  createId?: () => string;
}

export function createExperienceRun(
  input: CreateExperienceRunInput,
): ExperienceRunResult {
  const snapshot = cloneValue(input.plan);
  const invalid = validatePlanSnapshot(snapshot);
  if (invalid) {
    return {
      ok: false,
      run: placeholderRun(snapshot, input),
      error: invalid,
    };
  }

  const now = input.now ?? "2026-09-17T12:00:00.000Z";
  const createId = input.createId ?? (() => `experience-run-${snapshot.id}`);
  const stepRuns: ExperienceStepRun[] = snapshot.steps.map((step) => ({
    stepId: step.id,
    status: "PENDING",
  }));

  const run: ExperienceRun = {
    id: createId(),
    schemaVersion: "candidate-v0",
    experienceId: snapshot.id,
    planSnapshot: { plan: snapshot },
    status: "READY",
    currentStepIndex: 0,
    stepRuns,
    createdAt: now,
    updatedAt: now,
  };
  const runError = validateExperienceRun(run);
  if (runError) {
    return { ok: false, run, error: runError };
  }

  return { ok: true, run };
}

function placeholderRun(
  plan: LearningExperiencePlan,
  input: CreateExperienceRunInput,
): ExperienceRun {
  const now = input.now ?? "2026-09-17T12:00:00.000Z";
  return {
    id: "invalid-experience-run",
    schemaVersion: "candidate-v0",
    experienceId: plan.id,
    planSnapshot: { plan },
    status: "ABORTED",
    currentStepIndex: 0,
    stepRuns: [],
    createdAt: now,
    updatedAt: now,
    abortReason: "invalid plan snapshot",
  };
}

function validatePlanSnapshot(plan: LearningExperiencePlan) {
  if (plan.schemaVersion !== "candidate-v0") {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "Experience plan schemaVersion must be candidate-v0",
      "plan.schemaVersion",
    );
  }
  if (plan.steps.length === 0) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "Experience plan must contain at least one step",
      "plan.steps",
    );
  }

  const seen = new Set<string>();
  for (const step of plan.steps) {
    if (!step.id.trim()) {
      return executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        "Experience step ids must be non-empty",
        "plan.steps",
      );
    }
    if (seen.has(step.id)) {
      return executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        `Duplicate experience step id ${step.id}`,
        "plan.steps",
      );
    }
    seen.add(step.id);
  }

  for (const stepId of plan.completionPolicy.requiredStepIds) {
    if (!seen.has(stepId)) {
      return executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        `requiredStepId ${stepId} is not in the plan`,
        "plan.completionPolicy.requiredStepIds",
      );
    }
  }
  for (const stepId of plan.completionPolicy.terminalStepIds) {
    if (!seen.has(stepId)) {
      return executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        `terminalStepId ${stepId} is not in the plan`,
        "plan.completionPolicy.terminalStepIds",
      );
    }
  }
  if (plan.completionPolicy.terminalStepIds.length === 0) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "Experience plan must declare at least one terminal step",
      "plan.completionPolicy.terminalStepIds",
    );
  }

  const unreachable = findUnreachableRequiredSteps(plan);
  if (unreachable) {
    return unreachable;
  }

  const completion = plan.completionPolicy as unknown as Record<string, unknown>;
  for (const key of LEARNER_MUTATION_KEYS) {
    if (key in completion) {
      return executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        "Completion policy must not depend on learner-state mutation",
        "plan.completionPolicy",
      );
    }
  }

  return null;
}

/**
 * A terminal / END step ends the experience. Every required step must already
 * be completable by that index; otherwise the policy can never be satisfied.
 */
function findUnreachableRequiredSteps(plan: LearningExperiencePlan) {
  const required = plan.completionPolicy.requiredStepIds;
  for (const [index, step] of plan.steps.entries()) {
    const endsExperience =
      step.transition.onTaskCompleted === "END" ||
      plan.completionPolicy.terminalStepIds.includes(step.id);
    if (!endsExperience) {
      continue;
    }
    const completable = new Set(
      plan.steps.slice(0, index + 1).map((item) => item.id),
    );
    const missing = required.filter((stepId) => !completable.has(stepId));
    if (missing.length > 0) {
      return executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        `Terminal step ${step.id} would end the experience before required steps ${missing.join(", ")} can complete`,
        "plan.completionPolicy",
      );
    }
  }
  return null;
}
