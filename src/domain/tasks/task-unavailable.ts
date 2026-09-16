import type { GeneratedLearningTask } from "./generated-learning-task";

export enum TaskUnavailableCode {
  LEXEME_NOT_FOUND = "LEXEME_NOT_FOUND",
  SKILL_NOT_SUPPORTED = "SKILL_NOT_SUPPORTED",
  MISSING_REQUIRED_CONTENT = "MISSING_REQUIRED_CONTENT",
  NO_APPROVED_RELATION = "NO_APPROVED_RELATION",
  INSUFFICIENT_DISTRACTORS = "INSUFFICIENT_DISTRACTORS",
  CONTENT_POLICY_BLOCKED = "CONTENT_POLICY_BLOCKED",
  UNSUPPORTED_WEAKNESS = "UNSUPPORTED_WEAKNESS",
}

export type TaskGenerationResult =
  | {
      status: "GENERATED";
      value: GeneratedLearningTask;
    }
  | {
      status: "UNAVAILABLE";
      code: TaskUnavailableCode;
      reason: string;
      metadata?: Record<string, unknown>;
    };
