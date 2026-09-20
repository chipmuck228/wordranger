/**
 * Contextual Strengthen Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 */

import type { LexemeSenseRef } from "../domain/types";
import type {
  ContextualSupportExposure,
  ContextualSupportKind,
} from "./types";

export function supportExposuresForStrengthenStep(input: {
  stepId: string;
  target: LexemeSenseRef;
  shownAt: string;
}): ContextualSupportExposure[] {
  if (input.stepId.endsWith("-strengthen-reconnect")) {
    return [
      exposure("LEXICAL_FORM", input),
      exposure("MEANING_GLOSS", input),
    ];
  }
  if (input.stepId.endsWith("-strengthen-fade")) {
    return [exposure("SPELLING_CUE", input)];
  }
  return [];
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

function exposure(
  kind: ContextualSupportKind,
  input: {
    stepId: string;
    target: LexemeSenseRef;
    shownAt: string;
  },
): ContextualSupportExposure {
  return {
    supportId: `strengthen-support:${kind}:${input.stepId}`,
    kind,
    target: { lexemeId: input.target.lexemeId, senseId: input.target.senseId },
    shownAt: input.shownAt,
    sourceStepId: input.stepId,
  };
}
