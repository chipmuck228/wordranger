import { describe, expect, it } from "vitest";
import { SupabaseLearningTaskRepository } from "@/server/tasks/supabase-learning-task-repository";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import { PromptMode, AnswerMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LearningTaskType, TASK_GENERATOR_VERSION, TASK_PROTOCOL_VERSION } from "@/domain/tasks/task-type";

function sampleTask(): GeneratedLearningTask {
  return {
    publicTask: {
      id: "task-1",
      protocolVersion: TASK_PROTOCOL_VERSION,
      generatorVersion: TASK_GENERATOR_VERSION,
      learningNeedId: "need",
      lexemeId: "lex-spoon",
      targetSkill: VocabularySkill.ACTIVE_RECALL,
      taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
      promptMode: PromptMode.MEANING_TO_WORD,
      answerMode: AnswerMode.TYPING,
      difficulty: 0.4,
      prompt: { kind: "MEANING_TEXT", text: "勺子" },
      responseContract: { kind: "TEXT_INPUT", placeholder: "Type", maxLength: 64 },
      hints: [],
      createdAt: "2026-09-25T00:00:00.000Z",
    },
    answerKey: {
      taskId: "task-1",
      targetLexemeId: "lex-spoon",
      correctOptionIds: ["opt-1"],
      optionLexemeIds: {},
      exactAcceptedTexts: [],
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

function fakeClient() {
  const filters: Array<{ column: string; value: unknown }> = [];
  let selected: string | null = null;
  const api = {
    from(table: string) {
      expect(table).toBe("learning_tasks");
      return api;
    },
    select(columns: string) {
      selected = columns;
      return api;
    },
    eq(column: string, value: unknown) {
      filters.push({ column, value });
      return api;
    },
    async maybeSingle() {
      return { data: null, error: null };
    },
  };
  return { api, filters, get selected() { return selected; } };
}

describe("SupabaseLearningTaskRepository ownership query", () => {
  it("filters id, user_id, and session_id before returning a row", async () => {
    const fake = fakeClient();
    const repo = new SupabaseLearningTaskRepository(fake.api as never);
    await repo.getTaskForEvaluation({
      taskId: "task-1",
      userId: "user-a",
      sessionId: "session-1",
    });
    expect(fake.selected).toContain("answer_key");
    expect(fake.filters).toEqual([
      { column: "id", value: "task-1" },
      { column: "user_id", value: "user-a" },
      { column: "session_id", value: "session-1" },
    ]);
  });

  it("does not query answer_key when ownership fields are empty", async () => {
    const fake = fakeClient();
    const repo = new SupabaseLearningTaskRepository(fake.api as never);
    const result = await repo.getTaskForEvaluation({
      taskId: "task-1",
      userId: "",
      sessionId: "session-1",
    });
    expect(result).toBeNull();
    expect(fake.filters).toEqual([]);
    expect(fake.selected).toBeNull();
  });

  it("still inserts assignment identity with the generated task", async () => {
    const inserted: Record<string, unknown>[] = [];
    const client = {
      from() {
        return {
          insert(row: Record<string, unknown>) {
            inserted.push(row);
            return { error: null };
          },
        };
      },
    };
    const repo = new SupabaseLearningTaskRepository(client as never);
    await repo.saveGeneratedTask({
      task: sampleTask(),
      assignment: { userId: "user-a", sessionId: "session-1" },
    });
    expect(inserted[0]?.user_id).toBe("user-a");
    expect(inserted[0]?.session_id).toBe("session-1");
    expect(inserted[0]?.answer_key).toBeTruthy();
  });
});
