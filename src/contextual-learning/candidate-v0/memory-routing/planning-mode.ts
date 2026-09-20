/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Maps a completed routing decision onto the existing planner CognitiveMode.
 * Does not inspect learner snapshots.
 */

import type {
  ContextualMemoryIntent,
  ContextualMemoryRoutingDecision,
} from "./types";

export type PlanningModeFromRouting =
  | { ok: true; mode: ContextualMemoryIntent }
  | {
      ok: false;
      code: "MEMORY_ROUTING_UNRESOLVED";
      decision: Extract<ContextualMemoryRoutingDecision, { status: "UNRESOLVED" }>;
    };

export function planningModeFromRoutingDecision(
  decision: ContextualMemoryRoutingDecision,
): PlanningModeFromRouting {
  if (decision.status !== "RESOLVED") {
    return {
      ok: false,
      code: "MEMORY_ROUTING_UNRESOLVED",
      decision,
    };
  }
  return { ok: true, mode: decision.intent };
}
