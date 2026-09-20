/**
 * Contextual Probe Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * READY / UNRESOLVED never become planner modes.
 */

import { sameLexemeSense } from "../domain/lexeme-sense";
import type { LexemeSenseRef } from "../domain/types";
import type { ContextualMemoryIntent } from "../memory-routing/types";
import type { ContextualProbeRoutingResult } from "./types";

export type ProbePlannerConversion =
  | { ok: true; mode: ContextualMemoryIntent }
  | {
      ok: false;
      code:
        | "PROBE_DISPOSITION_NOT_PLANNABLE"
        | "PROBE_DISPOSITION_TARGET_MISMATCH";
    };

export function planningIntentFromProbeDisposition(
  result: ContextualProbeRoutingResult,
  expectedTarget: LexemeSenseRef,
): ProbePlannerConversion {
  if (!sameLexemeSense(result.target, expectedTarget)) {
    return { ok: false, code: "PROBE_DISPOSITION_TARGET_MISMATCH" };
  }
  if (result.disposition === "BUILD" || result.disposition === "STRENGTHEN") {
    return { ok: true, mode: result.disposition };
  }
  return { ok: false, code: "PROBE_DISPOSITION_NOT_PLANNABLE" };
}
