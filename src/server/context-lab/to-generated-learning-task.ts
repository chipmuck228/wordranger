import "server-only";

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";

export { assignedTasksMatch } from "@/server/tasks/assigned-tasks-match";

/**
 * Adapter from Candidate compilation output onto the frozen GeneratedLearningTask
 * shape required by LearningTaskRepository. Does not invent Evidence.
 */
export function toGeneratedLearningTask(input: {
  publicTask: PublicLearningTask;
  answerKey: TaskAnswerKey;
}): GeneratedLearningTask {
  return {
    publicTask: structuredClone(input.publicTask),
    answerKey: structuredClone(input.answerKey),
    generationTrace: {
      generatorVersion: input.publicTask.generatorVersion,
      archetype: input.publicTask.taskType,
      targetLexemeId: input.publicTask.lexemeId,
      candidateLexemeIds: [input.publicTask.lexemeId],
      selectedDistractorLexemeIds: [],
      relationIds: [],
      blockedCandidates: [],
      policyVersion: "candidate-v0-compiler",
    },
  };
}
