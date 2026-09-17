import type { TaskCompilationRequest } from "@/contextual-learning/candidate-v0/compilation/types";
import { findProfile } from "@/contextual-learning/candidate-v0/domain/lexeme-sense";
import type {
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

export function resolveTargets(
  plan: LearningExperiencePlan,
  step: ExperienceStepSpec,
  profiles: ReadonlyMap<string, SenseSemanticProfile>,
): ResolvedTargetSnapshot[] {
  return step.targetIds.flatMap((targetId) => {
    const target = plan.targets.find((item) => item.id === targetId);
    if (!target) {
      return [];
    }
    return [
      {
        targetId: target.id,
        sense: target.sense,
        displayForm: findProfile(profiles, target.sense)?.displayForm ?? "",
        focus: target.focus,
      },
    ];
  });
}

export function compilationRequest(input: {
  plan: LearningExperiencePlan;
  step: ExperienceStepSpec;
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
