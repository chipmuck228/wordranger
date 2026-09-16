import type { LearningEvidence } from "@/domain/learning/evidence.types";
import type { PublicLearningTask } from "./public-learning-task";
import type { TaskAnswerKey } from "./task-answer-key";
import type { TaskEvaluation } from "./task-evaluation";
import { TaskProtocolError } from "./task-evaluator";

export interface CreateEvidenceFromEvaluationInput {
  task: PublicLearningTask;
  answerKey: TaskAnswerKey;
  evaluation: TaskEvaluation;
  userId: string;
  sessionId: string;
  gameId: string;
  evidenceId: string;
}

function assertFactoryConsistency(input: CreateEvidenceFromEvaluationInput): void {
  if (input.evaluation.taskId !== input.task.id) {
    throw new TaskProtocolError(
      "EVIDENCE_TASK_MISMATCH",
      `Evaluation taskId ${input.evaluation.taskId} does not match task ${input.task.id}`,
    );
  }
  if (input.answerKey.taskId !== input.task.id) {
    throw new TaskProtocolError(
      "EVIDENCE_ANSWER_KEY_MISMATCH",
      `Answer key taskId ${input.answerKey.taskId} does not match task ${input.task.id}`,
    );
  }
  if (input.evaluation.lexemeId !== input.task.lexemeId) {
    throw new TaskProtocolError(
      "EVIDENCE_LEXEME_MISMATCH",
      `Evaluation lexemeId ${input.evaluation.lexemeId} does not match task ${input.task.lexemeId}`,
    );
  }
  if (input.evaluation.skill !== input.task.targetSkill) {
    throw new TaskProtocolError(
      "EVIDENCE_SKILL_MISMATCH",
      `Evaluation skill ${input.evaluation.skill} does not match task ${input.task.targetSkill}`,
    );
  }
}

export function createLearningEvidenceFromTaskEvaluation(
  input: CreateEvidenceFromEvaluationInput,
): LearningEvidence {
  assertFactoryConsistency(input);
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
