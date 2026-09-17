import { describe, expect, it } from "vitest";
import {
  MATCHING_GAME_ID,
  RANGER_TRIAL_GAME_ID,
  WORD_BUBBLE_GAME_ID,
} from "@/server/auth/v1-user";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { sequentialIdFactory } from "../learning/helpers";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { makeNeed } from "../tasks/helpers";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { StudentAction } from "@/domain/tasks/student-action";

const NOW = "2026-09-16T12:00:00.000Z";
const USER = "cross-renderer-user";

function cloneTask(
  generated: GeneratedLearningTask,
  taskId: string,
): GeneratedLearningTask {
  return {
    publicTask: { ...generated.publicTask, id: taskId },
    answerKey: { ...generated.answerKey, taskId },
    generationTrace: { ...generated.generationTrace },
  };
}

describe("cross-renderer equivalence", () => {
  it("same CHOICE option yields the same TaskEvaluator result for Ranger Trial, Word Bubble, and Matching", async () => {
    const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
    const generator = new DefaultTaskGenerator(vocabulary);
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const generated = await generator.generate({
      need: makeNeed({
        lexemeId: quiet.id,
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      }),
      desiredDifficulty: 0.45,
      recentTasks: [],
      now: NOW,
      createId: sequentialIdFactory("cross"),
      random: new SeededRandomSource("cross-renderer"),
    });
    expect(generated.status).toBe("GENERATED");
    if (generated.status !== "GENERATED") {
      throw new Error(generated.reason);
    }
    expect(generated.value.publicTask.responseContract.kind).toBe("CHOICE");
    const rangerTask = cloneTask(generated.value, "task-ranger");
    const bubbleTask = cloneTask(generated.value, "task-bubble");
    const matchingTask = cloneTask(generated.value, "task-matching");
    const optionId = rangerTask.answerKey.correctOptionIds[0];
    const tasks = new InMemoryLearningTaskRepository();
    const learning = new InMemoryLearningRepository();
    await tasks.saveGeneratedTask({
      task: rangerTask,
      assignment: { userId: USER, sessionId: "sess-ranger" },
    });
    await tasks.saveGeneratedTask({
      task: bubbleTask,
      assignment: { userId: USER, sessionId: "sess-bubble" },
    });
    await tasks.saveGeneratedTask({
      task: matchingTask,
      assignment: { userId: USER, sessionId: "sess-matching" },
    });

    const rangerIntent: StudentAction = {
      kind: "CHOICE",
      taskId: rangerTask.publicTask.id,
      optionId,
      hintCount: 0,
      responseTimeMs: 800,
      occurredAt: NOW,
    };
    const bubbleIntent: StudentAction = {
      ...rangerIntent,
      taskId: bubbleTask.publicTask.id,
    };
    const matchingIntent: StudentAction = {
      ...rangerIntent,
      taskId: matchingTask.publicTask.id,
    };

    const ranger = await submitTaskAction({
      taskId: rangerTask.publicTask.id,
      action: rangerIntent,
      userId: USER,
      sessionId: "sess-ranger",
      gameId: RANGER_TRIAL_GAME_ID,
      evidenceId: "ev-ranger",
      learningTaskRepository: tasks,
      learningRepository: learning,
      now: NOW,
    });
    const bubble = await submitTaskAction({
      taskId: bubbleTask.publicTask.id,
      action: bubbleIntent,
      userId: USER,
      sessionId: "sess-bubble",
      gameId: WORD_BUBBLE_GAME_ID,
      evidenceId: "ev-bubble",
      learningTaskRepository: tasks,
      learningRepository: learning,
      now: NOW,
    });
    const matching = await submitTaskAction({
      taskId: matchingTask.publicTask.id,
      action: matchingIntent,
      userId: USER,
      sessionId: "sess-matching",
      gameId: MATCHING_GAME_ID,
      evidenceId: "ev-matching",
      learningTaskRepository: tasks,
      learningRepository: learning,
      now: NOW,
    });

    expect(ranger.evaluation.outcome).toBe(bubble.evaluation.outcome);
    expect(ranger.evaluation.outcome).toBe(matching.evaluation.outcome);
    expect(ranger.evaluation.errorType).toBe(bubble.evaluation.errorType);
    expect(ranger.evaluation.errorType).toBe(matching.evaluation.errorType);
    expect(ranger.evaluation.selectedLexemeId).toBe(
      bubble.evaluation.selectedLexemeId,
    );
    expect(ranger.evaluation.selectedLexemeId).toBe(
      matching.evaluation.selectedLexemeId,
    );
    expect(ranger.evaluation.isCorrect).toBe(bubble.evaluation.isCorrect);
    expect(ranger.evaluation.isCorrect).toBe(matching.evaluation.isCorrect);
    expect(ranger.evidence.gameId).toBe(RANGER_TRIAL_GAME_ID);
    expect(bubble.evidence.gameId).toBe(WORD_BUBBLE_GAME_ID);
    expect(matching.evidence.gameId).toBe(MATCHING_GAME_ID);
  });
});
