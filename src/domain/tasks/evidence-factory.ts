import type { LearningEvidence } from "@/domain/learning/evidence.types";
import type { PublicLearningTask } from "./public-learning-task";
import type { TaskAnswerKey } from "./task-answer-key";
import type { TaskEvaluation } from "./task-evaluation";

export interface CreateEvidenceFromEvaluationInput {
  task: PublicLearningTask;
  answerKey: TaskAnswerKey;
  evaluation: TaskEvaluation;
  userId: string;
  sessionId: string;
  gameId: string;
  evidenceId: string;
}

export function createLearningEvidenceFromTaskEvaluation(
  input: CreateEvidenceFromEvaluationInput,
): LearningEvidence {
  const distractorLexemeIds = Object.values(input.answerKey.optionLexemeIds)
    .filter((lexemeId): lexemeId is string => Boolean(lexemeId))
    .filter((lexemeId) => lexemeId !== input.task.lexemeId);
  return {
    id: input.evidenceId,
    userId: input.userId,
    lexemeId: input.evaluation.lexemeId,
    taskId: input.task.id,
    sessionId: input.sessionId,
    gameId: input.gameId,
    taskType: input.task.taskType,
    skill: input.evaluation.skill,
    promptMode: input.task.promptMode,
    outcome: input.evaluation.outcome,
    responseTimeMs: input.evaluation.responseTimeMs,
    hintCount: input.evaluation.hintCount,
    difficulty: input.task.difficulty,
    answerMode: input.task.answerMode,
    distractorLexemeIds,
    selectedLexemeId: input.evaluation.selectedLexemeId,
    typedAnswer: input.evaluation.typedAnswer,
    expectedAnswer: input.evaluation.expectedAnswer,
    errorType: input.evaluation.errorType,
    occurredAt: input.evaluation.occurredAt,
    metadata: {
      evaluationTaskId: input.evaluation.taskId,
    },
  };
}
