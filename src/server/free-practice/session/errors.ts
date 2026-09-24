import "server-only";

export type FreePracticeSessionErrorCode =
  | "SESSION_START_FAILED"
  | "SESSION_NOT_FOUND"
  | "SESSION_CONFLICT"
  | "TASK_GENERATION_FAILED"
  | "INVALID_STATE"
  | "NETWORK_ERROR";

export class FreePracticeSessionError extends Error {
  readonly code: FreePracticeSessionErrorCode;

  constructor(code: FreePracticeSessionErrorCode, message: string) {
    super(message);
    this.name = "FreePracticeSessionError";
    this.code = code;
  }
}
