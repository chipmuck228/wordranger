export enum SchedulerBlockedReason {
  UNSUPPORTED_CONTENT_CAPABILITY = "UNSUPPORTED_CONTENT_CAPABILITY",
  INVALID_LEXEME = "INVALID_LEXEME",
  MISSING_MODEL_DATA = "MISSING_MODEL_DATA",
  NO_USABLE_TARGET_SKILL = "NO_USABLE_TARGET_SKILL",
}

export class SchedulerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SchedulerError";
    this.code = code;
  }
}
