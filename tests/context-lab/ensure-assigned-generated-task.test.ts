import { describe, expect, it } from "vitest";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { ensureAssignedGeneratedTask } from "@/server/context-lab/ensure-assigned-generated-task";
import { toGeneratedLearningTask } from "@/server/context-lab/to-generated-learning-task";
import { LearningTaskType, TASK_GENERATOR_VERSION, TASK_PROTOCOL_VERSION } from "@/domain/tasks/task-type";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";

function sampleTask(id: string, accepted = "spoon") {
  return toGeneratedLearningTask({
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
      responseContract: { kind: "TEXT_INPUT", placeholder: "Type", maxLength: 64 },
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
  });
}

describe("ensureAssignedGeneratedTask", () => {
  it("saves a new assignment and reuses an identical one", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const task = sampleTask("00000000-0000-5000-8000-000000000001");
    const assignment = { userId: "user-1", sessionId: "run-1" };
    const first = await ensureAssignedGeneratedTask({ tasks, task, assignment });
    expect(first).toEqual({ ok: true, reused: false });
    const second = await ensureAssignedGeneratedTask({ tasks, task, assignment });
    expect(second).toEqual({ ok: true, reused: true });
  });

  it("rejects a conflicting assignment instead of treating every duplicate as success", async () => {
    const tasks = new InMemoryLearningTaskRepository();
    const task = sampleTask("00000000-0000-5000-8000-000000000002");
    await ensureAssignedGeneratedTask({
      tasks,
      task,
      assignment: { userId: "user-1", sessionId: "run-1" },
    });
    const conflict = await ensureAssignedGeneratedTask({
      tasks,
      task: sampleTask("00000000-0000-5000-8000-000000000002", "fork"),
      assignment: { userId: "user-1", sessionId: "run-1" },
    });
    expect(conflict).toEqual({ ok: false, reason: "CONFLICT" });
    const otherUser = await ensureAssignedGeneratedTask({
      tasks,
      task,
      assignment: { userId: "user-2", sessionId: "run-1" },
    });
    expect(otherUser).toEqual({ ok: false, reason: "CONFLICT" });
  });
});
