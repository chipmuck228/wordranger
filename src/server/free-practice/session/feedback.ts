import "server-only";

import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type { TaskEvaluation } from "@/domain/tasks/task-evaluation";
import type { FreePracticePublicFeedback } from "./types";

export const FREE_PRACTICE_CORRECT_MESSAGE = "答对了！";
export const FREE_PRACTICE_INCORRECT_MESSAGE = "回答不正确。";

export function isIndependentOrAssistedCorrect(
  outcome: EvidenceOutcome,
): boolean {
  return (
    outcome === EvidenceOutcome.INDEPENDENT_CORRECT ||
    outcome === EvidenceOutcome.ASSISTED_CORRECT
  );
}

/**
 * Safe public feedback only. Never copies expectedAnswer, AnswerKey,
 * or GameSubmissionFeedback.correction.
 */
export function toFreePracticePublicFeedbackFromEvaluation(
  evaluation: TaskEvaluation,
): FreePracticePublicFeedback {
  return {
    taskId: evaluation.taskId,
    correct: evaluation.isCorrect,
    message: evaluation.isCorrect
      ? FREE_PRACTICE_CORRECT_MESSAGE
      : FREE_PRACTICE_INCORRECT_MESSAGE,
  };
}

export function toFreePracticePublicFeedbackFromOutcome(
  taskId: string,
  outcome: EvidenceOutcome,
): FreePracticePublicFeedback {
  const correct = isIndependentOrAssistedCorrect(outcome);
  return {
    taskId,
    correct,
    message: correct
      ? FREE_PRACTICE_CORRECT_MESSAGE
      : FREE_PRACTICE_INCORRECT_MESSAGE,
  };
}

export function completionMessage(attempted: number, correct: number): string {
  return `本组练习完成。完成 ${attempted} 个。答对 ${correct} 个。`;
}
