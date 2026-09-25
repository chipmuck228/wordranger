"use server";

import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { LearningNeedReason } from "@/domain/learning/learning-need";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { TaskAssignment } from "@/domain/tasks/task-assignment";
import type { TaskGenerationResult } from "@/domain/tasks/task-unavailable";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import {
  submitTaskAction,
  type SubmitTaskActionResult,
} from "@/server/tasks/submit-task-action";
import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { DEBUG_GAME_ID, DEBUG_SESSION_ID, DEBUG_USER_ID } from "./debug-ids";

const debugTaskRepository = new InMemoryLearningTaskRepository();
const debugLearningRepository = new InMemoryLearningRepository();
let nextDebugTaskCreateIdSerial = 0;

function nextDebugTaskCreateId(): string {
  nextDebugTaskCreateIdSerial += 1;
  return `debug-task-${nextDebugTaskCreateIdSerial}`;
}

export async function generateDebugTask(input: {
  lexemeId: string;
  targetSkill: VocabularySkill;
  reason: LearningNeedReason;
  relatedLexemeId: string;
  seed: string;
  difficulty: number;
}): Promise<{
  generation: TaskGenerationResult;
  assignment: TaskAssignment | null;
}> {
  const vocabulary = new InMemoryVocabularyRepository(getVocabularyDataset());
  const generator = new DefaultTaskGenerator(vocabulary);
  const generation = await generator.generate({
    need: {
      id: "debug-need",
      lexemeId: input.lexemeId,
      targetSkill: input.targetSkill,
      priority: 1,
      reason: input.reason,
      weaknessFocus:
        input.reason === "WEAKNESS" && input.relatedLexemeId
          ? {
              weaknessId: "debug-weakness",
              type: WeaknessType.CONFUSION,
              relatedLexemeId: input.relatedLexemeId,
            }
          : undefined,
      preferredPromptModes: [],
      avoidRecentTaskTypes: [],
    },
    desiredDifficulty: input.difficulty,
    recentTasks: [],
    now: "2026-03-01T09:00:00.000Z",
    createId: nextDebugTaskCreateId,
    random: new SeededRandomSource(input.seed || "debug"),
  });
  if (generation.status !== "GENERATED") {
    return { generation, assignment: null };
  }
  const assignment: TaskAssignment = {
    userId: DEBUG_USER_ID,
    sessionId: DEBUG_SESSION_ID,
  };
  await debugTaskRepository.saveGeneratedTask({
    task: generation.value,
    assignment,
  });
  return { generation, assignment };
}

export async function submitDebugTaskAction(input: {
  taskId: string;
  action: StudentAction;
}): Promise<SubmitTaskActionResult> {
  return submitTaskAction({
    taskId: input.taskId,
    action: input.action,
    userId: DEBUG_USER_ID,
    sessionId: DEBUG_SESSION_ID,
    gameId: DEBUG_GAME_ID,
    evidenceId: crypto.randomUUID(),
    learningTaskRepository: debugTaskRepository,
    learningRepository: debugLearningRepository,
    now: input.action.occurredAt,
  });
}

export async function getAssignedDebugTask(taskId: string) {
  return debugTaskRepository.getTaskForEvaluation({
    taskId,
    userId: DEBUG_USER_ID,
    sessionId: DEBUG_SESSION_ID,
  });
}

export async function resetDebugTaskLab(): Promise<void> {
  debugTaskRepository.reset();
  debugLearningRepository.reset();
}

export type { GeneratedLearningTask, TaskAssignment, SubmitTaskActionResult };
