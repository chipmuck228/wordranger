import type { TaskCompilationRequest } from "@/contextual-learning/candidate-v0/compilation/types";
import { findProfile } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import type {
  AssessableExperienceStepSpec,
  ContextFrame,
  ExperienceStepSpec,
  LearningExperiencePlan,
  ResolvedTargetSnapshot,
  SemanticSkeleton,
  SenseSemanticProfile,
} from "@/contextual-learning/candidate-v0/domain/types";
import { resolveContextSnapshot } from "@/contextual-learning/candidate-v0/validation/resolve-context";

export function sequentialIds(prefix: string): () => string {
  let index = 0;
  return () => `${prefix}-${index++}`;
}

export function resolvePlanTargets(
  plan: LearningExperiencePlan,
  profiles: ReadonlyMap<string, SenseSemanticProfile>,
): ResolvedTargetSnapshot[] {
  return plan.targets.map((target) => ({
    targetId: target.id,
    sense: target.sense,
    displayForm: findProfile(profiles, target.sense)?.displayForm ?? "",
    focus: target.focus,
  }));
}

export function resolveTargets(
  plan: LearningExperiencePlan,
  step: ExperienceStepSpec,
  profiles: ReadonlyMap<string, SenseSemanticProfile>,
): ResolvedTargetSnapshot[] {
  const byId = new Map(
    resolvePlanTargets(plan, profiles).map((target) => [target.targetId, target]),
  );
  return step.targetIds.flatMap((targetId) => {
    const target = byId.get(targetId);
    return target ? [target] : [];
  });
}

export function resolvedSnapshotFor(
  plan: LearningExperiencePlan,
  frame: ContextFrame,
  skeleton: SemanticSkeleton,
  profiles: ReadonlyMap<string, SenseSemanticProfile>,
) {
  return {
    resolvedContext: resolveContextSnapshot(
      frame,
      skeleton,
      plan.activeGoalId,
    ),
    resolvedTargets: resolvePlanTargets(plan, profiles),
  };
}

export function compilationRequest(input: {
  plan: LearningExperiencePlan;
  step: AssessableExperienceStepSpec;
  frame: ContextFrame;
  skeleton: SemanticSkeleton;
  profiles: ReadonlyMap<string, SenseSemanticProfile>;
}): TaskCompilationRequest {
  return {
    experienceId: input.plan.id,
    learningNeedId: input.plan.sourceLearningNeedRef,
    step: input.step,
    resolvedContext: resolveContextSnapshot(
      input.frame,
      input.skeleton,
      input.plan.activeGoalId,
    ),
    resolvedTargets: resolveTargets(input.plan, input.step, input.profiles),
    supportPolicy: input.step.supportPolicy,
    now: "2026-09-17T12:00:00.000Z",
    createId: sequentialIds("ctx"),
  };
}
