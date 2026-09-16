import type { LearningPolicy } from "@/domain/learning/policies/learning-policy";
import type { LearningRepository } from "@/domain/learning/learning-repository";
import {
  processEvidence,
  type ProcessEvidenceResult,
} from "@/domain/learning/engine/process-evidence";
import type { LearningEvidence } from "@/domain/learning/evidence.types";
import { createLearningEvidenceFromTaskEvaluation } from "@/domain/tasks/evidence-factory";
import { DefaultTaskEvaluator } from "@/domain/tasks/default-task-evaluator";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskEvaluation } from "@/domain/tasks/task-evaluation";
import type { TaskEvaluator } from "@/domain/tasks/task-evaluator";
import { TaskProtocolError } from "@/domain/tasks/task-evaluator";

export interface SubmitTaskActionInput {
  taskId: string;
  action: StudentAction;
  userId: string;
  sessionId: string;
  gameId: string;
  evidenceId: string;
  learningTaskRepository: LearningTaskRepository;
  learningRepository: LearningRepository;
  evaluator?: TaskEvaluator;
  learningPolicy?: LearningPolicy;
  now?: string;
  createId?: () => string;
}

export interface SubmitTaskActionResult {
  task: PublicLearningTask;
  evaluation: TaskEvaluation;
  evidence: LearningEvidence;
  learningResult: ProcessEvidenceResult;
}

export async function submitTaskAction(
  input: SubmitTaskActionInput,
): Promise<SubmitTaskActionResult> {
  const assigned = await input.learningTaskRepository.getTaskForEvaluation(
    input.taskId,
  );
  if (!assigned) {
    throw new TaskProtocolError(
      "TASK_NOT_FOUND",
      `Task ${input.taskId} was not found`,
    );
  }
  if (assigned.assignment.userId !== input.userId) {
    throw new TaskProtocolError(
      "TASK_USER_MISMATCH",
      `Task ${input.taskId} is assigned to a different user`,
    );
  }
  if (assigned.assignment.sessionId !== input.sessionId) {
    throw new TaskProtocolError(
      "TASK_SESSION_MISMATCH",
      `Task ${input.taskId} is assigned to a different session`,
    );
  }
  if (input.action.taskId !== input.taskId) {
    throw new TaskProtocolError(
      "TASK_ACTION_ID_MISMATCH",
      `Action taskId ${input.action.taskId} does not match submission taskId ${input.taskId}`,
    );
  }

  const existing = await input.learningRepository.getEvidenceForLexeme(
    input.userId,
    assigned.task.publicTask.lexemeId,
  );
  if (existing.some((item) => item.taskId === input.taskId)) {
    throw new TaskProtocolError(
      "TASK_ALREADY_COMPLETED",
      `Task ${input.taskId} already has terminal evidence`,
    );
  }

  const evaluator = input.evaluator ?? new DefaultTaskEvaluator();
  const evaluation = evaluator.evaluate(
    assigned.task.publicTask,
    assigned.task.answerKey,
    input.action,
  );
  const evidence = createLearningEvidenceFromTaskEvaluation({
    task: assigned.task.publicTask,
    answerKey: assigned.task.answerKey,
    evaluation,
    userId: input.userId,
    sessionId: input.sessionId,
    gameId: input.gameId,
    evidenceId: input.evidenceId,
  });
  const learningResult = await processEvidence({
    evidence,
    repository: input.learningRepository,
    policy: input.learningPolicy,
    now: input.now ?? input.action.occurredAt,
    createId: input.createId,
  });
  return {
    task: assigned.task.publicTask,
    evaluation,
    evidence,
    learningResult,
  };
}
