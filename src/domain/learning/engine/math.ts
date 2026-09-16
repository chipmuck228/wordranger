export class LearningDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LearningDomainError";
    this.code = code;
  }
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function assertUnitInterval(value: number, field: string): void {
  if (value < 0 || value > 1 || Number.isNaN(value)) {
    throw new LearningDomainError(
      "INVALID_UNIT_INTERVAL",
      `${field} must be between 0 and 1 inclusive, received ${value}`,
    );
  }
}
