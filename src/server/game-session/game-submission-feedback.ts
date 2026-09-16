import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import type { TaskEvaluation } from "@/domain/tasks/task-evaluation";
import type {
  GameSubmissionFeedback,
  GameSubmissionStatus,
} from "./ranger-trial-session.types";

export type { GameSubmissionFeedback, GameSubmissionStatus };

export function mapOutcomeToFeedbackStatus(
  outcome: EvidenceOutcome,
): GameSubmissionStatus {
  switch (outcome) {
    case EvidenceOutcome.INDEPENDENT_CORRECT:
      return "CORRECT";
    case EvidenceOutcome.ASSISTED_CORRECT:
      return "ASSISTED";
    case EvidenceOutcome.INCORRECT:
      return "INCORRECT";
    case EvidenceOutcome.SKIPPED:
      return "SKIPPED";
    case EvidenceOutcome.TIMEOUT:
      return "TIMEOUT";
  }
}

export function toGameSubmissionFeedbackFromOutcome(
  outcome: EvidenceOutcome,
  expectedAnswer: string | null,
): GameSubmissionFeedback {
  const status = mapOutcomeToFeedbackStatus(outcome);
  if (status === "CORRECT" || status === "ASSISTED") {
    return {
      status,
      message: "答对了！",
      continueAvailable: true,
    };
  }
  if (status === "INCORRECT") {
    const text = expectedAnswer?.trim() ?? "";
    return {
      status,
      message: text ? `正确答案：${text}` : "回答不正确。",
      continueAvailable: true,
      correction: text ? { text } : undefined,
    };
  }
  if (status === "SKIPPED") {
    return {
      status,
      message: "这一题已跳过。",
      continueAvailable: true,
    };
  }
  return {
    status,
    message: "这一题已超时。",
    continueAvailable: true,
  };
}

export function toGameSubmissionFeedback(
  evaluation: TaskEvaluation,
): GameSubmissionFeedback {
  return toGameSubmissionFeedbackFromOutcome(
    evaluation.outcome,
    evaluation.expectedAnswer,
  );
}
