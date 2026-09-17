/**
 * Candidate V0 / Experimental / Not a Standard.
 * Execution-protocol errors. Distinct from compiler codes.
 */

export const ExecutionErrorCode = {
  EXEC_INVALID_PLAN_SNAPSHOT: "EXEC_INVALID_PLAN_SNAPSHOT",
  EXEC_INVALID_STATE_TRANSITION: "EXEC_INVALID_STATE_TRANSITION",
  EXEC_STEP_REQUEST_MISMATCH: "EXEC_STEP_REQUEST_MISMATCH",
  EXEC_TASK_ID_MISMATCH: "EXEC_TASK_ID_MISMATCH",
  EXEC_DUPLICATE_COMPLETION: "EXEC_DUPLICATE_COMPLETION",
  EXEC_CURRENT_STEP_BLOCKED: "EXEC_CURRENT_STEP_BLOCKED",
  EXEC_TERMINAL_POLICY_NOT_SATISFIED: "EXEC_TERMINAL_POLICY_NOT_SATISFIED",
} as const;

export type ExecutionErrorCode =
  (typeof ExecutionErrorCode)[keyof typeof ExecutionErrorCode];

export interface ExperienceExecutionError {
  code: ExecutionErrorCode | string;
  message: string;
  path: string;
}

export function executionError(
  code: ExecutionErrorCode | string,
  message: string,
  path = "run",
): ExperienceExecutionError {
  return { code, message, path };
}
