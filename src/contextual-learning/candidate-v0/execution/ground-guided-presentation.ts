/**
 * Candidate V0 / Experimental / Not a Standard.
 * Exact membership of Guided presentation refs in the frozen snapshot.
 */

import type { GuidedPresentation, ResolvedContextSnapshot } from "../domain/types";
import { ExecutionErrorCode, executionError, type ExperienceExecutionError } from "./errors";

export type GuidedPresentationGroundingResult =
  | { ok: true }
  | { ok: false; error: ExperienceExecutionError };

/**
 * Every presented entityId and fact predicate must already exist on the
 * frozen ResolvedContextSnapshot. Identity is entityBindings[].entityId and
 * facts[].predicate. No labels, prefixes, substring, or serialized forms.
 */
export function groundGuidedPresentation(input: {
  presentation: GuidedPresentation;
  resolvedContext: ResolvedContextSnapshot;
}): GuidedPresentationGroundingResult {
  const boundEntityIds = new Set(
    input.resolvedContext.entityBindings.map((binding) => binding.entityId),
  );
  const boundPredicates = new Set(
    input.resolvedContext.facts.map((fact) => fact.predicate),
  );

  const presentedEntityIds = input.presentation.presentedEntityIds ?? [];
  for (let index = 0; index < presentedEntityIds.length; index += 1) {
    const entityId = presentedEntityIds[index]!;
    if (!boundEntityIds.has(entityId)) {
      return {
        ok: false,
        error: executionError(
          ExecutionErrorCode.EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT,
          `Presented entity "${entityId}" is not bound in the frozen resolved context`,
          `presentation.presentedEntityIds[${index}]`,
        ),
      };
    }
  }

  const presentedFactPredicates = input.presentation.presentedFactPredicates ?? [];
  for (let index = 0; index < presentedFactPredicates.length; index += 1) {
    const predicate = presentedFactPredicates[index]!;
    if (!boundPredicates.has(predicate)) {
      return {
        ok: false,
        error: executionError(
          ExecutionErrorCode.EXEC_GUIDED_FACT_NOT_IN_CONTEXT,
          `Presented fact predicate "${predicate}" is not present in the frozen resolved context`,
          `presentation.presentedFactPredicates[${index}]`,
        ),
      };
    }
  }

  return { ok: true };
}
