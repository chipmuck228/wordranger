/**
 * Candidate V0 / Experimental / Not a Standard.
 * A compilation request must bind to the snapshotted plan, not a swapped context.
 */

import type { TaskCompilationRequest } from "../compilation/types";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { ExperienceStepSpec, LearningExperiencePlan } from "../domain/types";
import { ExecutionErrorCode, executionError } from "./errors";

export function matchCompilationRequestToSnapshot(input: {
  plan: LearningExperiencePlan;
  snapshotStep: ExperienceStepSpec;
  experienceId: string;
  compilationRequest: TaskCompilationRequest;
}) {
  const { plan, snapshotStep, experienceId, compilationRequest } = input;
  if (
    compilationRequest.experienceId !== experienceId ||
    compilationRequest.step.id !== snapshotStep.id
  ) {
    return executionError(
      ExecutionErrorCode.EXEC_STEP_REQUEST_MISMATCH,
      "Compilation request does not match the current snapshotted step",
      "compilationRequest.step",
    );
  }
  if (compilationRequest.learningNeedId !== plan.sourceLearningNeedRef) {
    return executionError(
      ExecutionErrorCode.EXEC_STEP_REQUEST_MISMATCH,
      "Compilation request learningNeedId does not match the snapshotted plan",
      "compilationRequest.learningNeedId",
    );
  }
  if (
    compilationRequest.resolvedContext.contextFrameId !== plan.contextFrameId
  ) {
    return executionError(
      ExecutionErrorCode.EXEC_STEP_REQUEST_MISMATCH,
      "Compilation request contextFrameId does not match the snapshotted plan",
      "compilationRequest.resolvedContext.contextFrameId",
    );
  }
  if (compilationRequest.resolvedContext.skeletonId !== plan.skeletonId) {
    return executionError(
      ExecutionErrorCode.EXEC_STEP_REQUEST_MISMATCH,
      "Compilation request skeletonId does not match the snapshotted plan",
      "compilationRequest.resolvedContext.skeletonId",
    );
  }
  if (!resolvedTargetsMatchStep(snapshotStep, plan, compilationRequest.resolvedTargets)) {
    return executionError(
      ExecutionErrorCode.EXEC_STEP_REQUEST_MISMATCH,
      "Compilation request resolvedTargets do not match the snapshotted step targets",
      "compilationRequest.resolvedTargets",
    );
  }
  return null;
}

function resolvedTargetsMatchStep(
  step: ExperienceStepSpec,
  plan: LearningExperiencePlan,
  resolvedTargets: TaskCompilationRequest["resolvedTargets"],
): boolean {
  if (resolvedTargets.length !== step.targetIds.length) {
    return false;
  }
  return step.targetIds.every((targetId, index) => {
    const resolved = resolvedTargets[index];
    const declared = plan.targets.find((target) => target.id === targetId);
    return (
      resolved?.targetId === targetId &&
      declared !== undefined &&
      sameLexemeSense(declared.sense, resolved.sense) &&
      declared.focus === resolved.focus
    );
  });
}
