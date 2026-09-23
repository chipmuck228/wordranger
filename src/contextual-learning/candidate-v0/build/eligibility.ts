/**
 * Contextual BUILD Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 */

import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { ContextualProbeDisposition } from "../probe/types";
import type { ProbeObservationRef } from "../probe/types";

const KNOWN_OUTCOMES = new Set<string>(Object.values(EvidenceOutcome));

const WEAK_RECALL = new Set<EvidenceOutcome>([
  EvidenceOutcome.ASSISTED_CORRECT,
  EvidenceOutcome.INCORRECT,
  EvidenceOutcome.SKIPPED,
  EvidenceOutcome.TIMEOUT,
]);

const HELD_RECOGNITION = new Set<EvidenceOutcome>([
  EvidenceOutcome.INDEPENDENT_CORRECT,
  EvidenceOutcome.ASSISTED_CORRECT,
]);

const FAILED_RECOGNITION = new Set<EvidenceOutcome>([
  EvidenceOutcome.INCORRECT,
  EvidenceOutcome.SKIPPED,
  EvidenceOutcome.TIMEOUT,
]);

export function isActiveRecallBuildEligible(input: {
  target: LexemeSenseRef;
  disposition: ContextualProbeDisposition;
  observations: readonly ProbeObservationRef[];
}): boolean {
  if (input.disposition !== "BUILD") {
    return false;
  }
  if (!input.target.lexemeId.trim() || !input.target.senseId.trim()) {
    return false;
  }
  if (
    input.observations.some(
      (item) =>
        !sameLexemeSense(item.target, input.target) ||
        !item.taskId.trim() ||
        !KNOWN_OUTCOMES.has(item.outcome),
    )
  ) {
    return false;
  }

  const recall = uniqueSkill(input.observations, "ACTIVE_RECALL");
  const recognition = uniqueSkill(input.observations, "MEANING_RECOGNITION");
  if (!recall || !recognition) {
    return false;
  }
  if (recall.taskId === recognition.taskId) {
    return false;
  }
  if (recall.outcome === EvidenceOutcome.INDEPENDENT_CORRECT) {
    return false;
  }
  if (!WEAK_RECALL.has(recall.outcome)) {
    return false;
  }
  if (HELD_RECOGNITION.has(recognition.outcome)) {
    return false;
  }
  return FAILED_RECOGNITION.has(recognition.outcome);
}

function uniqueSkill(
  observations: readonly ProbeObservationRef[],
  skill: ProbeObservationRef["skill"],
): ProbeObservationRef | null {
  const matches = observations.filter((item) => item.skill === skill);
  if (matches.length !== 1) {
    return null;
  }
  return matches[0];
}
