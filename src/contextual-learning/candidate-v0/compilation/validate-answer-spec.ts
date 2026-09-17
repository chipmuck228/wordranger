/**
 * Candidate V0 / Experimental / Not a Standard.
 * Validates author-declared answers. Does not infer them.
 */

import { DomainErrorCode } from "../domain/errors";
import type {
  ChoiceExpectedResponse,
  ExpectedSemanticResponse,
} from "../domain/types";
import { compileFail, type CompileResult } from "./types";

export function isChoiceExpectedResponse(
  expected: ExpectedSemanticResponse,
): expected is ChoiceExpectedResponse {
  return (
    expected.kind === "ENTITY_REF" ||
    expected.kind === "RELATION_CHOICE" ||
    expected.kind === "SEMANTIC_CLASS" ||
    expected.kind === "CLAIM_CHOICE"
  );
}

export function validateExplicitAnswerSpec(
  expected: ExpectedSemanticResponse,
): CompileResult | null {
  if (expected.kind === "ORDERED_ENTITY_REFS") {
    return compileFail(
      DomainErrorCode.COMPILATION_UNSUPPORTED_RESPONSE_KIND,
      "ORDERED_ENTITY_REFS has no frozen PublicLearningTask contract",
      "expectedResponse",
    );
  }

  if (expected.kind === "LEXICAL_FORM") {
    if (!expected.sense.lexemeId.trim() || !expected.sense.senseId.trim()) {
      return compileFail(
        DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
        "LEXICAL_FORM requires a complete LexemeSenseRef",
        "expectedResponse.sense",
      );
    }
    return null;
  }

  return validateExplicitChoice(expected);
}

export function validateExplicitChoice(
  expected: ChoiceExpectedResponse,
): CompileResult | null {
  if (expected.candidates.length === 0) {
    return compileFail(
      DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
      "Choice response must declare candidates",
      "expectedResponse.candidates",
    );
  }

  const seen = new Set<string>();
  for (const candidate of expected.candidates) {
    if (!candidate.id.trim()) {
      return compileFail(
        DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
        "Choice candidate id must be non-empty",
        "expectedResponse.candidates",
      );
    }
    if (!candidate.displayText.trim()) {
      return compileFail(
        DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
        `Choice candidate ${candidate.id} is missing displayText`,
        "expectedResponse.candidates",
      );
    }
    if (seen.has(candidate.id)) {
      return compileFail(
        DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
        `Duplicate candidate id ${candidate.id}`,
        "expectedResponse.candidates",
      );
    }
    seen.add(candidate.id);
  }

  if (expected.correctCandidateIds.length === 0) {
    return compileFail(
      DomainErrorCode.COMPILATION_MISSING_CORRECT_OPTION,
      "correctCandidateIds must declare at least one correct option",
      "expectedResponse.correctCandidateIds",
    );
  }

  for (const correctId of expected.correctCandidateIds) {
    if (!seen.has(correctId)) {
      return compileFail(
        DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
        `correctCandidateId ${correctId} is not a declared candidate`,
        "expectedResponse.correctCandidateIds",
      );
    }
  }

  const distractorCount =
    expected.candidates.length - new Set(expected.correctCandidateIds).size;
  if (distractorCount < 1) {
    return compileFail(
      DomainErrorCode.COMPILATION_INVALID_ANSWER_SPEC,
      "Choice response must include at least one distractor",
      "expectedResponse.candidates",
    );
  }

  return null;
}
