import type {
  ContextFrame,
  ResolvedContextSnapshot,
  SemanticFact,
  SemanticSkeleton,
} from "../domain/types";

/**
 * Immutable snapshot used by validators and the compiler.
 * Candidate V0 / Experimental / Not a Standard.
 */
export function resolveContextSnapshot(
  frame: ContextFrame,
  skeleton: SemanticSkeleton,
  activeGoalId: string,
): ResolvedContextSnapshot {
  const facts: SemanticFact[] = [...frame.initialFacts];
  for (const event of frame.eventBindings ?? []) {
    facts.push(...event.afterFacts);
  }
  return {
    contextFrameId: frame.id,
    skeletonId: skeleton.id,
    entityBindings: frame.entityBindings.map((binding) => ({ ...binding })),
    facts,
    activeGoalId,
    allowedSemanticActions: [...frame.allowedSemanticActions],
    sourceVersions: {
      [skeleton.id]: skeleton.version,
      [frame.id]: 0,
    },
    perspectiveBindings: frame.perspectiveBindings?.map((binding) => ({
      ...binding,
    })),
  };
}
