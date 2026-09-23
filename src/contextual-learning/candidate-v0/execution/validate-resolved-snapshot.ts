/**
 * Candidate V0 / Experimental / Not a Standard.
 * Plan ids must match the resolved snapshots captured at run creation.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type {
  LearningExperiencePlan,
  ResolvedContextSnapshot,
  ResolvedTargetSnapshot,
} from "../domain/types";
import { ExecutionErrorCode, executionError } from "./errors";

export function validateResolvedSnapshotAgainstPlan(input: {
  plan: LearningExperiencePlan;
  resolvedContext: ResolvedContextSnapshot;
  resolvedTargets: ResolvedTargetSnapshot[];
}) {
  const { plan, resolvedContext, resolvedTargets } = input;
  if (resolvedContext.contextFrameId !== plan.contextFrameId) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "resolvedContext.contextFrameId does not match the plan",
      "resolvedContext.contextFrameId",
    );
  }
  if (resolvedContext.skeletonId !== plan.skeletonId) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "resolvedContext.skeletonId does not match the plan",
      "resolvedContext.skeletonId",
    );
  }
  if (resolvedContext.activeGoalId !== plan.activeGoalId) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "resolvedContext.activeGoalId does not match the plan",
      "resolvedContext.activeGoalId",
    );
  }
  if (resolvedTargets.length !== plan.targets.length) {
    return executionError(
      ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
      "resolvedTargets must correspond 1:1 with plan.targets",
      "resolvedTargets",
    );
  }
  for (const [index, declared] of plan.targets.entries()) {
    const resolved = resolvedTargets[index];
    if (
      resolved?.targetId !== declared.id ||
      !sameLexemeSense(declared.sense, resolved.sense) ||
      declared.focus !== resolved.focus
    ) {
      return executionError(
        ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
        `resolvedTargets[${index}] does not match plan.targets[${index}]`,
        "resolvedTargets",
      );
    }
  }
  for (const step of plan.steps) {
    for (const targetId of step.targetIds) {
      if (!resolvedTargets.some((target) => target.targetId === targetId)) {
        return executionError(
          ExecutionErrorCode.EXEC_INVALID_PLAN_SNAPSHOT,
          `Step ${step.id} target ${targetId} is missing from resolvedTargets`,
          "resolvedTargets",
        );
      }
    }
  }
  return null;
}
