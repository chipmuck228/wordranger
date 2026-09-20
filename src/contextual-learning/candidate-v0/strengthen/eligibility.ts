/**
 * Contextual Strengthen Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 */

import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type { ContextualProbeDisposition } from "../probe/types";
import type { ProbeObservationRef } from "../probe/types";

const RECOGNIZED = new Set<EvidenceOutcome>([
  EvidenceOutcome.INDEPENDENT_CORRECT,
  EvidenceOutcome.ASSISTED_CORRECT,
]);

export function isSpoonActiveRecallStrengthenEligible(input: {
  targetLexemeId: string;
  spoonLexemeId: string;
  disposition: ContextualProbeDisposition;
  observations: readonly ProbeObservationRef[];
}): boolean {
  if (input.targetLexemeId !== input.spoonLexemeId) {
    return false;
  }
  if (input.disposition !== "STRENGTHEN") {
    return false;
  }
  const recall = input.observations.find((item) => item.skill === "ACTIVE_RECALL");
  const recognition = input.observations.find(
    (item) => item.skill === "MEANING_RECOGNITION",
  );
  if (!recall || !recognition) {
    return false;
  }
  if (recall.outcome === EvidenceOutcome.INDEPENDENT_CORRECT) {
    return false;
  }
  return RECOGNIZED.has(recognition.outcome);
}
