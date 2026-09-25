import { describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { DefaultTaskGenerator } from "@/domain/tasks/default-task-generator";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import type { StudentAction } from "@/domain/tasks/student-action";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { submitTaskAction } from "@/server/tasks/submit-task-action";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { sequentialIdFactory } from "../learning/helpers";
import { makeNeed } from "./helpers";

const NOW = "2026-09-25T00:00:00.000Z";
const USER_A = "user-a";
const USER_B = "user-b";
const SESSION_1 = "session-1";
const SESSION_2 = "session-2";

async function generateOwnedTask() {
  const vocabulary = new InMemoryVocabularyRepository(loadVocabularyDataset());
  const generator = new DefaultTaskGenerator(vocabulary);
  const [quiet] = await vocabulary.findLexemeByLemma("quiet");
  const generated = await generator.generate({
    need: makeNeed({
      lexemeId: quiet.id,
      targetSkill: VocabularySkill.MEANING_RECOGNITION,
    }),
    desiredDifficulty: 0.4,
    recentTasks: [],
    now: NOW,
    createId: sequentialIdFactory("own"),
    random: new SeededRandomSource("own"),
  });
  if (generated.status !== "GENERATED") {
    throw new Error(generated.reason);
  }
  return generated.value;
}

function correctChoice(taskId: string, optionId: string): StudentAction {
  return {
    kind: "CHOICE",
    taskId,
    optionId,
    hintCount: 0,
    responseTimeMs: 700,
    occurredAt: NOW,
  };
}

describe("task evaluation ownership", () => {
  it("lets the owner evaluate and hides the row from a foreign user or session", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const generated = await generateOwnedTask();
    await tasks.saveGeneratedTask({
      task: generated,
      assignment: { userId: USER_A, sessionId: SESSION_1 },
    });
    const owned = await tasks.getTaskForEvaluation({
      taskId: generated.publicTask.id,
      userId: USER_A,
      sessionId: SESSION_1,
    });
    const foreignUser = await tasks.getTaskForEvaluation({
      taskId: generated.publicTask.id,
      userId: USER_B,
      sessionId: SESSION_1,
    });
    const foreignSession = await tasks.getTaskForEvaluation({
      taskId: generated.publicTask.id,
      userId: USER_A,
      sessionId: SESSION_2,
    });
    const missing = await tasks.getTaskForEvaluation({
      taskId: "missing-task",
      userId: USER_A,
      sessionId: SESSION_1,
    });
    expect(owned?.task.answerKey.taskId).toBe(generated.publicTask.id);
    expect(foreignUser).toBeNull();
    expect(foreignSession).toBeNull();
    expect(missing).toBeNull();
  });

  it("maps missing and foreign submit attempts to the same TASK_NOT_FOUND", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const learning = new InMemoryLearningRepository();
    const generated = await generateOwnedTask();
    await tasks.saveGeneratedTask({
      task: generated,
      assignment: { userId: USER_A, sessionId: SESSION_1 },
    });
    const optionId = generated.answerKey.correctOptionIds[0] ?? "opt";
    const attempts = [
      submitTaskAction({
        taskId: generated.publicTask.id,
        action: correctChoice(generated.publicTask.id, optionId),
        userId: USER_B,
        sessionId: SESSION_1,
        gameId: "RANGER_TRIAL",
        evidenceId: "ev-b",
        learningTaskRepository: tasks,
        learningRepository: learning,
        now: NOW,
      }),
      submitTaskAction({
        taskId: generated.publicTask.id,
        action: correctChoice(generated.publicTask.id, optionId),
        userId: USER_A,
        sessionId: SESSION_2,
        gameId: "RANGER_TRIAL",
        evidenceId: "ev-s",
        learningTaskRepository: tasks,
        learningRepository: learning,
        now: NOW,
      }),
      submitTaskAction({
        taskId: "missing-task",
        action: correctChoice("missing-task", optionId),
        userId: USER_A,
        sessionId: SESSION_1,
        gameId: "RANGER_TRIAL",
        evidenceId: "ev-m",
        learningTaskRepository: tasks,
        learningRepository: learning,
        now: NOW,
      }),
    ];
    const results = await Promise.allSettled(attempts);
    expect(
      results.map((item) =>
        item.status === "rejected" && item.reason && typeof item.reason === "object"
          ? (item.reason as { code?: string }).code
          : item.status,
      ),
    ).toEqual(["TASK_NOT_FOUND", "TASK_NOT_FOUND", "TASK_NOT_FOUND"]);
    expect(
      await learning.getEvidenceForLexeme(USER_A, generated.publicTask.lexemeId),
    ).toEqual([]);
    expect(
      await learning.getEvidenceForLexeme(USER_B, generated.publicTask.lexemeId),
    ).toEqual([]);
  });

  it("does not return answer_key for an incomplete lookup", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const generated = await generateOwnedTask();
    await tasks.saveGeneratedTask({
      task: generated,
      assignment: { userId: USER_A, sessionId: SESSION_1 },
    });
    expect(
      await tasks.getTaskForEvaluation({
        taskId: generated.publicTask.id,
        userId: "",
        sessionId: SESSION_1,
      }),
    ).toBeNull();
  });
});
