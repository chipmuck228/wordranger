/**
 * Candidate V0 / Experimental / Not a Standard.
 * Stable error codes for validators and the frozen-task compiler.
 */

export const DomainErrorCode = {
  CTX_UNKNOWN_ROLE: "CTX_UNKNOWN_ROLE",
  CTX_MISSING_REQUIRED_BINDING: "CTX_MISSING_REQUIRED_BINDING",
  CTX_UNGROUNDED_CLAIM: "CTX_UNGROUNDED_CLAIM",
  CTX_AMBIGUOUS_DIRECTION: "CTX_AMBIGUOUS_DIRECTION",
  CTX_MISSING_PERSPECTIVE: "CTX_MISSING_PERSPECTIVE",
  CTX_UNKNOWN_ENTITY: "CTX_UNKNOWN_ENTITY",
  CTX_UNKNOWN_GOAL: "CTX_UNKNOWN_GOAL",
  CTX_ACTION_NOT_LICENSED: "CTX_ACTION_NOT_LICENSED",
  CTX_MISSING_SENSE_ID: "CTX_MISSING_SENSE_ID",
  CTX_RENDERER_LEAK: "CTX_RENDERER_LEAK",
  CTX_LEXEME_AS_ROLE_IDENTITY: "CTX_LEXEME_AS_ROLE_IDENTITY",
  CTX_GENERAL_ABILITY_OVERCLAIM: "CTX_GENERAL_ABILITY_OVERCLAIM",
  EXP_TARGET_NOT_REACHABLE: "EXP_TARGET_NOT_REACHABLE",
  EXP_UNSUPPORTED_SEMANTIC_ACTION: "EXP_UNSUPPORTED_SEMANTIC_ACTION",
  EXP_NO_RUNTIME_CAPABILITY: "EXP_NO_RUNTIME_CAPABILITY",
  EXP_RECALL_LEAKS_ANSWER: "EXP_RECALL_LEAKS_ANSWER",
  EXP_INVALID_SUPPORT_ORDER: "EXP_INVALID_SUPPORT_ORDER",
  EXP_MISSING_LEARNING_NEED_REF: "EXP_MISSING_LEARNING_NEED_REF",
  EXP_COMPLETION_MUTATES_LEARNER: "EXP_COMPLETION_MUTATES_LEARNER",
  COMPILATION_UNSUPPORTED_RESPONSE_KIND: "COMPILATION_UNSUPPORTED_RESPONSE_KIND",
  COMPILATION_FROZEN_CONTRACT_MISMATCH: "COMPILATION_FROZEN_CONTRACT_MISMATCH",
  COMPILATION_MISSING_CORRECT_OPTION: "COMPILATION_MISSING_CORRECT_OPTION",
  COMPILATION_INVALID_ANSWER_SPEC: "COMPILATION_INVALID_ANSWER_SPEC",
  COMPILATION_SEMANTIC_MISMATCH: "COMPILATION_SEMANTIC_MISMATCH",
  COMPILATION_AMBIGUOUS_SENSE_PROJECTION: "COMPILATION_AMBIGUOUS_SENSE_PROJECTION",
} as const;

export type DomainErrorCode =
  (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export interface DomainValidationIssue {
  code: DomainErrorCode | string;
  path: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

export interface DomainValidationResult {
  ok: boolean;
  issues: DomainValidationIssue[];
}

export function errorIssue(
  code: DomainErrorCode | string,
  path: string,
  message: string,
): DomainValidationIssue {
  return { code, path, message, severity: "ERROR" };
}

export function warningIssue(
  code: DomainErrorCode | string,
  path: string,
  message: string,
): DomainValidationIssue {
  return { code, path, message, severity: "WARNING" };
}

export function validationResult(
  issues: DomainValidationIssue[],
): DomainValidationResult {
  return {
    ok: issues.every((issue) => issue.severity !== "ERROR"),
    issues,
  };
}
