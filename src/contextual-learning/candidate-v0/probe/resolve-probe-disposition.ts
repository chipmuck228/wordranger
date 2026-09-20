/**
 * Contextual Probe Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Maps frozen EvidenceOutcome observations to a Candidate disposition.
 * Does not grade, mutate Evidence, or write learner state.
 */

import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type {
  ContextualProbeRoutingResult,
  ContextualProbeSkill,
  ProbeObservationRef,
} from "./types";

const INDEPENDENT = EvidenceOutcome.INDEPENDENT_CORRECT;
const ASSISTED = EvidenceOutcome.ASSISTED_CORRECT;
const FAILED = new Set<EvidenceOutcome>([
  EvidenceOutcome.INCORRECT,
  EvidenceOutcome.SKIPPED,
  EvidenceOutcome.TIMEOUT,
]);

export function resolveProbeDisposition(input: {
  target: LexemeSenseRef;
  observations: readonly ProbeObservationRef[];
}): ContextualProbeRoutingResult {
  const target = { lexemeId: input.target.lexemeId, senseId: input.target.senseId };
  const observations = input.observations.map((item) => ({ ...item, target: { ...item.target } }));

  const mismatch = observations.find(
    (item) => !sameLexemeSense(item.target, target) || !item.taskId.trim(),
  );
  if (mismatch) {
    return unresolved(target, observations, "PROBE_TARGET_TASK_MISMATCH");
  }

  const recognition = uniqueSkill(observations, "MEANING_RECOGNITION");
  const recall = uniqueSkill(observations, "ACTIVE_RECALL");
  if (recognition === "CONFLICT" || recall === "CONFLICT") {
    return unresolved(target, observations, "PROBE_CONFLICTING_OUTCOMES");
  }

  if (!recognition) {
    return unresolved(target, observations, "PROBE_MISSING_RECOGNITION");
  }

  if (FAILED.has(recognition.outcome)) {
    return resolved(target, observations, "BUILD", "PROBE_RECOGNITION_FAILED");
  }
  if (recognition.outcome === ASSISTED) {
    return resolved(target, observations, "STRENGTHEN", "PROBE_RECOGNITION_ASSISTED");
  }
  if (recognition.outcome !== INDEPENDENT) {
    return unresolved(target, observations, "PROBE_UNMAPPED_RECOGNITION_OUTCOME");
  }

  if (!recall) {
    return unresolved(target, observations, "PROBE_MISSING_RECALL_AFTER_INDEPENDENT_RECOGNITION");
  }
  if (recall.outcome === INDEPENDENT) {
    return resolved(target, observations, "READY", "PROBE_INDEPENDENT_RECOGNITION_AND_RECALL");
  }
  if (recall.outcome === ASSISTED || FAILED.has(recall.outcome)) {
    return resolved(target, observations, "STRENGTHEN", "PROBE_RECALL_NOT_INDEPENDENT");
  }
  return unresolved(target, observations, "PROBE_UNMAPPED_RECALL_OUTCOME");
}

function uniqueSkill(
  observations: readonly ProbeObservationRef[],
  skill: ContextualProbeSkill,
): ProbeObservationRef | null | "CONFLICT" {
  const matches = observations.filter((item) => item.skill === skill);
  if (matches.length === 0) {
    return null;
  }
  const outcomes = new Set(matches.map((item) => item.outcome));
  const taskIds = new Set(matches.map((item) => item.taskId));
  if (outcomes.size > 1 || taskIds.size > 1) {
    return "CONFLICT";
  }
  return matches[0];
}

function resolved(
  target: LexemeSenseRef,
  observations: readonly ProbeObservationRef[],
  disposition: Exclude<ContextualProbeRoutingResult["disposition"], "UNRESOLVED">,
  ruleId: string,
): ContextualProbeRoutingResult {
  return {
    target,
    disposition,
    observations,
    reason: ruleId,
    provenance: {
      source: "FROZEN_LEARNING_EVIDENCE",
      taskIds: observations.map((item) => item.taskId),
      evidenceIds: observations
        .map((item) => item.evidenceId)
        .filter((id): id is string => Boolean(id)),
      ruleId,
    },
  };
}

function unresolved(
  target: LexemeSenseRef,
  observations: readonly ProbeObservationRef[],
  ruleId: string,
): ContextualProbeRoutingResult {
  return {
    target,
    disposition: "UNRESOLVED",
    observations,
    reason: ruleId,
    provenance: {
      source: "FROZEN_LEARNING_EVIDENCE",
      taskIds: observations.map((item) => item.taskId),
      evidenceIds: observations
        .map((item) => item.evidenceId)
        .filter((id): id is string => Boolean(id)),
      ruleId,
    },
  };
}
