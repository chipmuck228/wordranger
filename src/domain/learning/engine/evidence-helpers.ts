import {
  AnswerMode,
  EvidenceErrorType,
  EvidenceOutcome,
  type LearningEvidence,
} from "../evidence.types";
import type { LearningPolicy } from "../policies/learning-policy";
import { VocabularySkill } from "../vocabulary-skill";
import { WeaknessType } from "../weakness.types";
import { calendarDay, distinctCount } from "./time";

export function isSkipped(evidence: LearningEvidence): boolean {
  return evidence.outcome === EvidenceOutcome.SKIPPED;
}

export function isFailure(evidence: LearningEvidence): boolean {
  return (
    evidence.outcome === EvidenceOutcome.INCORRECT ||
    evidence.outcome === EvidenceOutcome.TIMEOUT
  );
}

export function isSuccess(evidence: LearningEvidence): boolean {
  return (
    evidence.outcome === EvidenceOutcome.CORRECT ||
    evidence.outcome === EvidenceOutcome.INDEPENDENT_CORRECT ||
    evidence.outcome === EvidenceOutcome.ASSISTED_CORRECT
  );
}

export function isIndependentSuccess(evidence: LearningEvidence): boolean {
  if (evidence.hintCount > 0) {
    return false;
  }
  return (
    evidence.outcome === EvidenceOutcome.INDEPENDENT_CORRECT ||
    evidence.outcome === EvidenceOutcome.CORRECT
  );
}

export function isExposure(evidence: LearningEvidence): boolean {
  return evidence.outcome !== EvidenceOutcome.SKIPPED;
}

export function isAssistedCorrect(evidence: LearningEvidence): boolean {
  return evidence.outcome === EvidenceOutcome.ASSISTED_CORRECT;
}

export function isProductionIndependentSuccess(
  evidence: LearningEvidence,
  policy: LearningPolicy,
): boolean {
  return (
    policy.recall.productionSkills.includes(evidence.skill) &&
    policy.recall.productionAnswerModes.includes(evidence.answerMode) &&
    isIndependentSuccess(evidence)
  );
}

export function isMultipleChoiceOnly(evidence: LearningEvidence): boolean {
  return evidence.answerMode === AnswerMode.MULTIPLE_CHOICE;
}

export function contextVariantId(evidence: LearningEvidence): string | null {
  const metadata = evidence.metadata;
  if (!metadata) {
    return null;
  }
  const contextId = metadata.contextId;
  if (typeof contextId === "string" && contextId.length > 0) {
    return contextId;
  }
  const taskVariantId = metadata.taskVariantId;
  if (typeof taskVariantId === "string" && taskVariantId.length > 0) {
    return taskVariantId;
  }
  return null;
}

export function distinctSessions(evidence: readonly LearningEvidence[]): number {
  return distinctCount(evidence.map((item) => item.sessionId));
}

export function distinctPracticeDays(
  evidence: readonly LearningEvidence[],
): number {
  return distinctCount(evidence.map((item) => calendarDay(item.occurredAt)));
}

export function distinctTaskTypes(evidence: readonly LearningEvidence[]): number {
  return distinctCount(evidence.map((item) => item.taskType));
}

export function skillEvidence(
  history: readonly LearningEvidence[],
  skill: VocabularySkill,
): LearningEvidence[] {
  return history.filter((item) => item.skill === skill);
}

export function polarity(evidence: LearningEvidence): 1 | -1 | 0 {
  if (isSuccess(evidence)) {
    return 1;
  }
  if (isFailure(evidence)) {
    return -1;
  }
  return 0;
}

export function countAlternations(history: readonly LearningEvidence[]): number {
  let previous: 1 | -1 | null = null;
  let flips = 0;
  for (const item of history) {
    const current = polarity(item);
    if (current === 0) {
      continue;
    }
    if (previous !== null && current !== previous) {
      flips += 1;
    }
    previous = current;
  }
  return flips;
}

export function isSpellingErrorType(
  errorType: EvidenceErrorType | null,
): boolean {
  return (
    errorType === EvidenceErrorType.SPELLING_MINOR ||
    errorType === EvidenceErrorType.SPELLING_MAJOR
  );
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const even = sorted.length % 2 === 0;
  if (even) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function weaknessTypeForSkill(skill: VocabularySkill): WeaknessType {
  switch (skill) {
    case VocabularySkill.MEANING_RECOGNITION:
      return WeaknessType.MEANING;
    case VocabularySkill.LISTENING_RECOGNITION:
      return WeaknessType.LISTENING;
    case VocabularySkill.SPELLING_RECALL:
      return WeaknessType.SPELLING;
    case VocabularySkill.ACTIVE_RECALL:
      return WeaknessType.ACTIVE_RECALL;
    case VocabularySkill.CONTEXT_USE:
      return WeaknessType.CONTEXT;
    case VocabularySkill.SEMANTIC_CONNECTION:
      return WeaknessType.SEMANTIC_RELATION;
  }
}
