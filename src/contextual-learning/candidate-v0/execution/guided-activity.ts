/**
 * Candidate V0 / Experimental / Not a Standard.
 * Presentation-only activity. No answer, score, skill, or Evidence.
 */

import type { GuidedActivityKind, GuidedExperienceStepSpec } from "../domain/types";

export interface PublicGuidedActivity {
  id: string;
  protocolVersion: "candidate-v0";
  experienceId: string;
  stepId: string;
  contextFrameId: string;
  kind: GuidedActivityKind;
  instruction: string;
  presentedEntityIds?: string[];
  presentedFactPredicates?: string[];
  completionContract: {
    kind: "ACKNOWLEDGE_ONLY";
  };
}

export interface GuidedActivityCompletionReceipt {
  activityId: string;
  completedAt: string;
}

export function guidedActivityId(experienceId: string, stepId: string): string {
  return `guided:${experienceId}:${stepId}`;
}

export function createPublicGuidedActivity(input: {
  experienceId: string;
  contextFrameId: string;
  step: GuidedExperienceStepSpec;
}): PublicGuidedActivity {
  const { experienceId, contextFrameId, step } = input;
  return {
    id: guidedActivityId(experienceId, step.id),
    protocolVersion: "candidate-v0",
    experienceId,
    stepId: step.id,
    contextFrameId,
    kind: step.executionIntent.guidedActivityKind,
    instruction: step.presentation.instruction,
    presentedEntityIds: step.presentation.presentedEntityIds,
    presentedFactPredicates: step.presentation.presentedFactPredicates,
    completionContract: { kind: "ACKNOWLEDGE_ONLY" },
  };
}
