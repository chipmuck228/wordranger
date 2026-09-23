/**
 * Candidate V0 / Experimental / Not a Standard.
 * Abort is explicit. Compile failure never auto-aborts.
 */

import { cloneValue } from "./clone";
import { ExecutionErrorCode, executionError } from "./errors";
import type { ExperienceRun, ExperienceRunResult } from "./types";

export interface AbortExperienceRunInput {
  run: ExperienceRun;
  reason: string;
  now?: string;
}

export function abortExperienceRun(
  input: AbortExperienceRunInput,
): ExperienceRunResult {
  if (input.run.status === "COMPLETED" || input.run.status === "ABORTED") {
    return {
      ok: false,
      run: input.run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        `Cannot abort a ${input.run.status} experience run`,
        "run.status",
      ),
    };
  }
  if (!input.reason.trim()) {
    return {
      ok: false,
      run: input.run,
      error: executionError(
        ExecutionErrorCode.EXEC_INVALID_STATE_TRANSITION,
        "Abort requires a non-empty reason",
        "reason",
      ),
    };
  }

  const now = input.now ?? "2026-09-17T12:00:00.000Z";
  return {
    ok: true,
    run: {
      ...cloneValue(input.run),
      status: "ABORTED",
      abortReason: input.reason,
      updatedAt: now,
      stepRuns: input.run.stepRuns.map((stepRun) => ({ ...stepRun })),
    },
  };
}
