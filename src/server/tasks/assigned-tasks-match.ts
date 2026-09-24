import "server-only";

import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";

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
