"use server";

import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { LearningNeedReason } from "@/domain/learning/learning-need";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { TaskGenerationResult } from "@/domain/tasks/task-unavailable";
import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";

export async function generateDebugTask(input: {
  lexemeId: string;
  targetSkill: VocabularySkill;
  reason: LearningNeedReason;
  relatedLexemeId: string;
  seed: string;
  difficulty: number;
}): Promise<TaskGenerationResult> {
  const vocabulary = new InMemoryVocabularyRepository(getVocabularyDataset());
  const generator = new DefaultTaskGenerator(vocabulary);
  let count = 0;
  return generator.generate({
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
    createId: () => `debug-task-${++count}`,
    random: new SeededRandomSource(input.seed || "debug"),
  });
}

export type { GeneratedLearningTask };
