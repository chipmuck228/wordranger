import "server-only";

import type { LearningEvidence } from "@/domain/learning/evidence.types";
import type { TaskEvaluation } from "@/domain/tasks/task-evaluation";
import {
  toGameSubmissionFeedback,
  toGameSubmissionFeedbackFromOutcome,
} from "@/server/game-session/game-submission-feedback";
import type { ContextLabTaskFeedback } from "@/components/context-lab/types";

export function contextLabFeedbackFromEvaluation(
  evaluation: TaskEvaluation,
): ContextLabTaskFeedback {
  return toPublicFeedback(toGameSubmissionFeedback(evaluation));
}

export function contextLabFeedbackFromEvidence(
  evidence: LearningEvidence,
): ContextLabTaskFeedback {
  return toPublicFeedback(
    toGameSubmissionFeedbackFromOutcome(evidence.outcome, evidence.expectedAnswer),
  );
}

function toPublicFeedback(feedback: {
  status: ContextLabTaskFeedback["status"];
  message: string;
  correction?: { text: string };
}): ContextLabTaskFeedback {
  return {
    status: feedback.status,
    message: feedback.message,
    ...(feedback.correction ? { correction: { text: feedback.correction.text } } : {}),
  };
}
