import { describe, expect, it } from "vitest";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type { AssignedLearningTask } from "@/domain/tasks/task-assignment";
import {
  LearningTaskType,
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import { ensureAssignedGeneratedTask } from "@/server/tasks/ensure-assigned-generated-task";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";

function sampleTask(id: string, accepted = "spoon"): GeneratedLearningTask {
  return {
    publicTask: {
      id,
      protocolVersion: TASK_PROTOCOL_VERSION,
      generatorVersion: TASK_GENERATOR_VERSION,
      learningNeedId: "need",
      lexemeId: "lex-spoon",
      targetSkill: VocabularySkill.ACTIVE_RECALL,
      taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
      promptMode: PromptMode.MEANING_TO_WORD,
      answerMode: AnswerMode.TYPING,
      difficulty: 0.5,
      prompt: { kind: "MEANING_TEXT", text: "勺子" },
      responseContract: {
        kind: "TEXT_INPUT",
        placeholder: "Type",
        maxLength: 64,
      },
      hints: [],
      createdAt: "2026-09-20T00:00:00.000Z",
    },
    answerKey: {
      taskId: id,
      targetLexemeId: "lex-spoon",
      correctOptionIds: [],
      optionLexemeIds: {},
      exactAcceptedTexts: [accepted],
      semanticAcceptedTexts: [],
    },
    generationTrace: {
      generatorVersion: TASK_GENERATOR_VERSION,
      archetype: LearningTaskType.ACTIVE_RECALL_TYPING,
      targetLexemeId: "lex-spoon",
      candidateLexemeIds: ["lex-spoon"],
      selectedDistractorLexemeIds: [],
      relationIds: [],
      blockedCandidates: [],
      policyVersion: "v1",
    },
  };
}

function assigned(
  task: GeneratedLearningTask,
  userId = "user-1",
  sessionId = "run-1",
): AssignedLearningTask {
  return { task, assignment: { userId, sessionId } };
}

describe("ensureAssignedGeneratedTask unique race", () => {
  it("re-reads a compatible winner after 23505", async () => {
    const task = sampleTask("00000000-0000-5000-8000-000000000010");
    const winner = assigned(task);
    let gets = 0;
    const tasks: LearningTaskRepository = {
      async getTaskForEvaluation() {
        gets += 1;
        return gets === 1 ? null : winner;
      },
      async saveGeneratedTask() {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      },
    };
    const result = await ensureAssignedGeneratedTask({
      tasks,
      task,
      assignment: winner.assignment,
    });
    expect(result).toEqual({ ok: true, reused: true });
    expect(gets).toBe(2);
  });

  it("does not treat an incompatible unique-race winner as success", async () => {
    const task = sampleTask("00000000-0000-5000-8000-000000000011");
    const winner = assigned(sampleTask("00000000-0000-5000-8000-000000000011", "fork"));
    let gets = 0;
    const tasks: LearningTaskRepository = {
      async getTaskForEvaluation() {
        gets += 1;
        return gets === 1 ? null : winner;
      },
      async saveGeneratedTask() {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      },
    };
    const result = await ensureAssignedGeneratedTask({
      tasks,
      task,
      assignment: { userId: "user-1", sessionId: "run-1" },
    });
    expect(result).toEqual({ ok: false, reason: "CONFLICT" });
  });

  it("still saves once on the in-memory path", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const task = sampleTask("00000000-0000-5000-8000-000000000012");
    const assignment = { userId: "user-1", sessionId: "run-1" };
    await ensureAssignedGeneratedTask({ tasks, task, assignment });
    await ensureAssignedGeneratedTask({ tasks, task, assignment });
    expect(tasks.listTaskIds()).toEqual([task.publicTask.id]);
  });
});
