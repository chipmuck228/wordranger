import type { PublicLearningTask } from "./public-learning-task";
import type { StudentAction } from "./student-action";
import type { TaskAnswerKey } from "./task-answer-key";
import type { TaskEvaluation } from "./task-evaluation";

export interface TaskEvaluator {
  evaluate(
    task: PublicLearningTask,
    answerKey: TaskAnswerKey,
    action: StudentAction,
  ): TaskEvaluation;
}

export class TaskProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TaskProtocolError";
    this.code = code;
  }
}
