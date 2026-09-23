/**
 * Contextual Strengthen Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 */

import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { ContextualProbeDisposition } from "../probe/types";
import type { ProbeObservationRef } from "../probe/types";
import { BUNDLED_SPOON_LEXEME_ID } from "../memory-routing/bundled-lexeme-bindings";

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

export function isActiveRecallStrengthenEligible(input: {
  target: LexemeSenseRef;
  disposition: ContextualProbeDisposition;
  observations: readonly ProbeObservationRef[];
}): boolean {
  if (input.disposition !== "STRENGTHEN") {
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
  if (!WEAK_RECALL.has(recall.outcome)) {
    return false;
  }
  return HELD_RECOGNITION.has(recognition.outcome);
}

export function isSpoonActiveRecallStrengthenEligible(input: {
  target: LexemeSenseRef;
  disposition: ContextualProbeDisposition;
  observations: readonly ProbeObservationRef[];
}): boolean {
  return (
    input.target.lexemeId === BUNDLED_SPOON_LEXEME_ID &&
    isActiveRecallStrengthenEligible(input)
  );
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
