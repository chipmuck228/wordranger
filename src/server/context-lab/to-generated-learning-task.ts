import "server-only";

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { TaskAnswerKey } from "@/domain/tasks/task-answer-key";

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

export function assignedTasksMatch(
  left: GeneratedLearningTask,
  right: GeneratedLearningTask,
): boolean {
  return (
    stableJson(publicTaskIdentity(left.publicTask)) ===
      stableJson(publicTaskIdentity(right.publicTask)) &&
    stableJson(left.answerKey) === stableJson(right.answerKey) &&
    left.generationTrace.targetLexemeId === right.generationTrace.targetLexemeId &&
    left.generationTrace.archetype === right.generationTrace.archetype
  );
}

function publicTaskIdentity(task: PublicLearningTask): unknown {
  return {
    id: task.id,
    protocolVersion: task.protocolVersion,
    generatorVersion: task.generatorVersion,
    learningNeedId: task.learningNeedId,
    lexemeId: task.lexemeId,
    targetSkill: task.targetSkill,
    taskType: task.taskType,
    promptMode: task.promptMode,
    answerMode: task.answerMode,
    difficulty: task.difficulty,
    prompt: task.prompt,
    responseContract: task.responseContract,
    hints: task.hints,
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}
