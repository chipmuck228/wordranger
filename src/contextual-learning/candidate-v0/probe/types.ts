/**
 * Contextual Probe Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Probe dispositions are next-experience choices, not mastery.
 */

import type { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type { CognitiveMode, LexemeSenseRef } from "../domain/types";
import type { ContextualMemoryIntent } from "../memory-routing/types";

export type ContextualProbeSkill = "MEANING_RECOGNITION" | "ACTIVE_RECALL";

export interface ContextualProbeTarget {
  target: LexemeSenseRef;
  sceneClusterId: string;
  roleId: string;
  entityId: string;
  displayLabel: string;
  probeSkills: readonly ContextualProbeSkill[];
}

export type ContextualProbeDisposition =
  | "BUILD"
  | "STRENGTHEN"
  | "READY"
  | "UNRESOLVED";

export interface ProbeObservationRef {
  target: LexemeSenseRef;
  skill: ContextualProbeSkill;
  taskId: string;
  evidenceId?: string;
  outcome: EvidenceOutcome;
}

export interface ContextualProbeRoutingResult {
  target: LexemeSenseRef;
  disposition: ContextualProbeDisposition;
  observations: readonly ProbeObservationRef[];
  reason: string;
  provenance: {
    source: "FROZEN_LEARNING_EVIDENCE";
    taskIds: readonly string[];
    evidenceIds?: readonly string[];
    ruleId: string;
  };
}

export type ProbePlanningIntent = Extract<CognitiveMode, ContextualMemoryIntent>;
