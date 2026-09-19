/**
 * Candidate V0 / Experimental / Not a Standard.
 * Execution-protocol errors. Distinct from compiler codes.
 */

export const ExecutionErrorCode = {
  EXEC_INVALID_PLAN_SNAPSHOT: "EXEC_INVALID_PLAN_SNAPSHOT",
  EXEC_INVALID_STATE_TRANSITION: "EXEC_INVALID_STATE_TRANSITION",
  EXEC_STEP_REQUEST_MISMATCH: "EXEC_STEP_REQUEST_MISMATCH",
  EXEC_TASK_ID_MISMATCH: "EXEC_TASK_ID_MISMATCH",
  EXEC_ACTIVITY_ID_MISMATCH: "EXEC_ACTIVITY_ID_MISMATCH",
  EXEC_RECEIPT_KIND_MISMATCH: "EXEC_RECEIPT_KIND_MISMATCH",
  EXEC_STEP_UNSUPPORTED: "EXEC_STEP_UNSUPPORTED",
  EXEC_DUPLICATE_COMPLETION: "EXEC_DUPLICATE_COMPLETION",
  EXEC_CURRENT_STEP_BLOCKED: "EXEC_CURRENT_STEP_BLOCKED",
  EXEC_TERMINAL_POLICY_NOT_SATISFIED: "EXEC_TERMINAL_POLICY_NOT_SATISFIED",
  EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT: "EXEC_GUIDED_ENTITY_NOT_IN_CONTEXT",
  EXEC_GUIDED_FACT_NOT_IN_CONTEXT: "EXEC_GUIDED_FACT_NOT_IN_CONTEXT",
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
