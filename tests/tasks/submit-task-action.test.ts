import { describe, expect, it } from "vitest";
import { EvidenceErrorType, EvidenceOutcome } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { sequentialIdFactory } from "../learning/helpers";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { makeNeed, makeNeedWithConfusion } from "./helpers";
import type { StudentAction } from "@/domain/tasks/student-action";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";

const NOW = "2026-03-01T09:00:00.000Z";
const USER_A = "user-a";
const SESSION_1 = "session-1";
const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
const generator = new DefaultTaskGenerator(vocabulary);

async function generateMeaningTask(seed = "h-submit"): Promise<GeneratedLearningTask> {
  const [quiet] = await vocabulary.findLexemeByLemma("quiet");
  const generated = await generator.generate({
    need: makeNeed({
      lexemeId: quiet.id,
      targetSkill: VocabularySkill.MEANING_RECOGNITION,
    }),
    desiredDifficulty: 0.4,
    recentTasks: [],
    now: NOW,
    createId: sequentialIdFactory(seed),
    random: new SeededRandomSource(seed),
  });
  if (generated.status !== "GENERATED") {
    throw new Error(generated.reason);
  }
  return generated.value;
}

function correctChoice(task: GeneratedLearningTask): StudentAction {
  return {
    kind: "CHOICE",
    taskId: task.publicTask.id,
    optionId: task.answerKey.correctOptionIds[0],
    hintCount: 0,
    responseTimeMs: 700,
    occurredAt: NOW,
  };
}

describe("submitTaskAction", () => {
  it("TEST H1: matching user and session is accepted", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const learning = new InMemoryLearningRepository();
    const generated = await generateMeaningTask("h1");
    await tasks.saveGeneratedTask({
      task: generated,
      assignment: { userId: USER_A, sessionId: SESSION_1 },
    });
    const result = await submitTaskAction({
      taskId: generated.publicTask.id,
      action: correctChoice(generated),
      userId: USER_A,
      sessionId: SESSION_1,
      gameId: "debug-task-lab",
      evidenceId: "ev-h1",
      learningTaskRepository: tasks,
      learningRepository: learning,
      now: NOW,
    });
    expect(result.evaluation.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(result.evidence.taskId).toBe(generated.publicTask.id);
    expect(result.evidence.userId).toBe(USER_A);
    expect(result.learningResult.model.lexemeId).toBe(generated.publicTask.lexemeId);
  });

  it("TEST H2: user mismatch creates no evidence and no model", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const learning = new InMemoryLearningRepository();
    const generated = await generateMeaningTask("h2");
    await tasks.saveGeneratedTask({
      task: generated,
      assignment: { userId: USER_A, sessionId: SESSION_1 },
    });
    await expect(
      submitTaskAction({
        taskId: generated.publicTask.id,
        action: correctChoice(generated),
        userId: "user-b",
        sessionId: SESSION_1,
        gameId: "debug-task-lab",
        evidenceId: "ev-h2",
        learningTaskRepository: tasks,
        learningRepository: learning,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "TASK_NOT_FOUND" });
    expect(
      await learning.getEvidenceForLexeme("user-b", generated.publicTask.lexemeId),
    ).toEqual([]);
    expect(
      await learning.getStudentLexemeModel("user-b", generated.publicTask.lexemeId),
    ).toBeNull();
    expect(
      await learning.getEvidenceForLexeme(USER_A, generated.publicTask.lexemeId),
    ).toEqual([]);
  });

  it("TEST H3: session mismatch creates no evidence and no model", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const learning = new InMemoryLearningRepository();
    const generated = await generateMeaningTask("h3");
    await tasks.saveGeneratedTask({
      task: generated,
      assignment: { userId: USER_A, sessionId: SESSION_1 },
    });
    await expect(
      submitTaskAction({
        taskId: generated.publicTask.id,
        action: correctChoice(generated),
        userId: USER_A,
        sessionId: "session-2",
        gameId: "debug-task-lab",
        evidenceId: "ev-h3",
        learningTaskRepository: tasks,
        learningRepository: learning,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "TASK_NOT_FOUND" });
    expect(
      await learning.getEvidenceForLexeme(USER_A, generated.publicTask.lexemeId),
    ).toEqual([]);
    expect(
      await learning.getStudentLexemeModel(USER_A, generated.publicTask.lexemeId),
    ).toBeNull();
  });

  it("TEST H4: authoritative pipeline returns task, evaluation, evidence, and learning result", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const learning = new InMemoryLearningRepository();
    const generated = await generateMeaningTask("h4");
    await tasks.saveGeneratedTask({
      task: generated,
      assignment: { userId: USER_A, sessionId: SESSION_1 },
    });
    const result = await submitTaskAction({
      taskId: generated.publicTask.id,
      action: correctChoice(generated),
      userId: USER_A,
      sessionId: SESSION_1,
      gameId: "quiz-renderer",
      evidenceId: "ev-h4",
      learningTaskRepository: tasks,
      learningRepository: learning,
      now: NOW,
    });
    expect(result.task.id).toBe(generated.publicTask.id);
    expect(result.task).not.toHaveProperty("correctOptionIds");
    expect(result.evaluation.taskId).toBe(generated.publicTask.id);
    expect(result.evidence.taskId).toBe(generated.publicTask.id);
    expect(result.evidence.gameId).toBe("quiz-renderer");
    expect(result.evidence.taskType).toBe(generated.publicTask.taskType);
    expect(result.evidence.gameId).not.toBe(result.evidence.taskType);
    expect(result.learningResult.evidence.id).toBe("ev-h4");
    expect(result.learningResult.model.evidenceCount).toBe(1);
  });

  it("TEST H5: confusable wrong choice through submitTaskAction produces CONFUSION", async () => {
    const [quiet] = await vocabulary.findLexemeByLemma("quiet");
    const [quite] = await vocabulary.findLexemeByLemma("quite");
    const tasks = new InMemoryLearningTaskRepository();
    const learning = new InMemoryLearningRepository();
    let lastSelected: string | null = null;
    for (const [index, occurredAt] of [NOW, "2026-03-02T09:00:00.000Z"].entries()) {
      const generated = await generator.generate({
        need: makeNeedWithConfusion(quiet.id, quite.id),
        desiredDifficulty: 0.4,
        recentTasks: [],
        now: occurredAt,
        createId: sequentialIdFactory(`h5-${index}`),
        random: new SeededRandomSource(`h5-${index}`),
      });
      if (generated.status !== "GENERATED") {
        throw new Error(generated.reason);
      }
      const wrong = Object.entries(generated.value.answerKey.optionLexemeIds).find(
        ([, lexemeId]) => lexemeId === quite.id,
      );
      expect(wrong).toBeTruthy();
      await tasks.saveGeneratedTask({
        task: generated.value,
        assignment: { userId: USER_A, sessionId: SESSION_1 },
      });
      const result = await submitTaskAction({
        taskId: generated.value.publicTask.id,
        action: {
          kind: "CHOICE",
          taskId: generated.value.publicTask.id,
          optionId: wrong![0],
          hintCount: 0,
          responseTimeMs: 800,
          occurredAt,
        },
        userId: USER_A,
        sessionId: SESSION_1,
        gameId: "debug-task-lab",
        evidenceId: `ev-h5-${index}`,
        learningTaskRepository: tasks,
        learningRepository: learning,
        now: occurredAt,
      });
      expect(result.evaluation.outcome).toBe(EvidenceOutcome.INCORRECT);
      expect(result.evaluation.errorType).toBe(EvidenceErrorType.CONFUSED_WITH_WORD);
      expect(result.evaluation.selectedLexemeId).toBe(quite.id);
      lastSelected = result.learningResult.model.weaknesses.find(
        (weakness) => weakness.type === WeaknessType.CONFUSION,
      )?.relatedLexemeId ?? null;
    }
    expect(lastSelected).toBe(quite.id);
  });
});
