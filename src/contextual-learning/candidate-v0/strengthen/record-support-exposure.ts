/**
 * Contextual Strengthen Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 */

import {
  isGuidedExperienceStep,
  type ExperienceStepSpec,
} from "../domain/types";
import type { ContextualSupportExposure } from "./types";

export function supportExposuresForStrengthenStep(input: {
  step: ExperienceStepSpec;
  planId: string;
  shownAt: string;
}): ContextualSupportExposure[] {
  if (!isGuidedExperienceStep(input.step) || !input.step.supportExposure) {
    return [];
  }
  const { kinds, target } = input.step.supportExposure;
  if (!input.planId.trim() || !target.lexemeId.trim() || !target.senseId.trim()) {
    return [];
  }
  return kinds.map((kind) => ({
    supportId: `strengthen-support:${kind}:${input.step.id}`,
    kind,
    target: { lexemeId: target.lexemeId, senseId: target.senseId },
    shownAt: input.shownAt,
    sourceStepId: input.step.id,
    planId: input.planId,
  }));
}

export function mergeSupportExposures(
  existing: readonly ContextualSupportExposure[],
  next: readonly ContextualSupportExposure[],
): ContextualSupportExposure[] {
  const merged = existing.map((item) => ({
    ...item,
    target: { ...item.target },
  }));
  for (const item of next) {
    const duplicate = merged.some(
      (seen) =>
        seen.supportId === item.supportId &&
        seen.sourceStepId === item.sourceStepId &&
        seen.kind === item.kind &&
        seen.planId === item.planId &&
        seen.target.lexemeId === item.target.lexemeId &&
        seen.target.senseId === item.target.senseId,
    );
    if (!duplicate) {
      merged.push({
        ...item,
        target: { ...item.target },
      });
    }
  }
  return merged;
}
