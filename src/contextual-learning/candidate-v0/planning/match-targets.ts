/**
 * Candidate V0 / Experimental / Not a Standard.
 * Structured target admission. Does not rewrite input or plan targets.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { ExperienceTarget } from "../domain/types";
import type { RejectedTargetRequirement } from "./types";

export type TargetRequirementField =
  | "sense"
  | "focus"
  | "requiredRoleIds"
  | "requiredRelationIds";

export function idsCovered(
  available: readonly string[] | undefined,
  requested: readonly string[] | undefined,
): boolean {
  const have = new Set(available ?? []);
  return (requested ?? []).every((id) => have.has(id));
}

export function matchRequestedTargetsToPlan(input: {
  variantId: string;
  requested: readonly ExperienceTarget[];
  planTargets: readonly ExperienceTarget[];
}):
  | { ok: true }
  | { ok: false; rejection: RejectedTargetRequirement } {
  for (const [index, requested] of input.requested.entries()) {
    const rejection = matchOneRequestedTarget({
      variantId: input.variantId,
      requested,
      planTargets: input.planTargets,
      index,
    });
    if (rejection) {
      return { ok: false, rejection };
    }
  }
  return { ok: true };
}

function matchOneRequestedTarget(input: {
  variantId: string;
  requested: ExperienceTarget;
  planTargets: readonly ExperienceTarget[];
  index: number;
}): RejectedTargetRequirement | null {
  const { requested, planTargets, variantId, index } = input;
  const sameSense = planTargets.filter((target) =>
    sameLexemeSense(target.sense, requested.sense),
  );
  if (sameSense.length === 0) {
    return rejection({
      variantId,
      requested,
      index,
      field: "sense",
      requestedValue: `${requested.sense.lexemeId}::${requested.sense.senseId}`,
      availableValue: planTargets.map(
        (target) => `${target.sense.lexemeId}::${target.sense.senseId}`,
      ),
    });
  }
  const sameFocus = sameSense.filter((target) => target.focus === requested.focus);
  if (sameFocus.length === 0) {
    return rejection({
      variantId,
      requested,
      index,
      field: "focus",
      requestedValue: requested.focus,
      availableValue: unique(sameSense.map((target) => target.focus)),
    });
  }
  const missingRole = firstUncovered(
    sameFocus,
    requested.requiredRoleIds,
    (target) => target.requiredRoleIds,
  );
  if (missingRole) {
    return rejection({
      variantId,
      requested,
      index,
      field: "requiredRoleIds",
      requestedValue: [...(requested.requiredRoleIds ?? [])],
      availableValue: unique(
        sameFocus.flatMap((target) => target.requiredRoleIds ?? []),
      ),
    });
  }
  const missingRelation = firstUncovered(
    sameFocus,
    requested.requiredRelationIds,
    (target) => target.requiredRelationIds,
  );
  if (missingRelation) {
    return rejection({
      variantId,
      requested,
      index,
      field: "requiredRelationIds",
      requestedValue: [...(requested.requiredRelationIds ?? [])],
      availableValue: unique(
        sameFocus.flatMap((target) => target.requiredRelationIds ?? []),
      ),
    });
  }
  return null;
}

function firstUncovered(
  candidates: readonly ExperienceTarget[],
  requested: readonly string[] | undefined,
  read: (target: ExperienceTarget) => readonly string[] | undefined,
): string | undefined {
  if (!requested || requested.length === 0) {
    return undefined;
  }
  const covered = candidates.some((target) => idsCovered(read(target), requested));
  if (covered) {
    return undefined;
  }
  return requested[0];
}

function rejection(input: {
  variantId: string;
  requested: ExperienceTarget;
  index: number;
  field: TargetRequirementField;
  requestedValue: string | string[];
  availableValue: string | string[];
}): RejectedTargetRequirement {
  return {
    variantId: input.variantId,
    requestedTargetId: input.requested.id,
    lexemeId: input.requested.sense.lexemeId,
    senseId: input.requested.sense.senseId,
    field: input.field,
    requested: input.requestedValue,
    available: input.availableValue,
    path: `targets[${input.index}].${input.field}`,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
