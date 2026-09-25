import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import { PromptMode, AnswerMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import {
  LearningTaskType,
  TASK_GENERATOR_VERSION,
  TASK_PROTOCOL_VERSION,
} from "@/domain/tasks/task-type";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { SupabaseLearningTaskRepository } from "@/server/tasks/supabase-learning-task-repository";

function sampleTask(id: string): GeneratedLearningTask {
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
      difficulty: 0.4,
      prompt: { kind: "MEANING_TEXT", text: "勺子" },
      responseContract: { kind: "TEXT_INPUT", placeholder: "Type", maxLength: 64 },
      hints: [],
      createdAt: "2026-09-25T00:00:00.000Z",
    },
    answerKey: {
      taskId: id,
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

describe("learning task repository uniqueness", () => {
  it("rejects a second in-memory save of the same task id with 23505 and does not overwrite", async () => {
    const repo = new InMemoryLearningTaskRepository();
    const first = sampleTask("dup-task");
    await repo.saveGeneratedTask({
      task: first,
      assignment: { userId: "user-a", sessionId: "session-1" },
    });
    let caught: { code?: string } | undefined;
    try {
      await repo.saveGeneratedTask({
        task: sampleTask("dup-task"),
        assignment: { userId: "user-b", sessionId: "session-2" },
      });
    } catch (error) {
      caught = error as { code?: string };
    }
    expect(caught?.code).toBe("23505");
    const stored = await repo.getTaskForEvaluation({
      taskId: "dup-task",
      userId: "user-a",
      sessionId: "session-1",
    });
    expect(stored?.assignment).toEqual({
      userId: "user-a",
      sessionId: "session-1",
    });
    expect(
      await repo.getTaskForEvaluation({
        taskId: "dup-task",
        userId: "user-b",
        sessionId: "session-2",
      }),
    ).toBeNull();
  });

  it("lets the Supabase adapter surface insert 23505 and never upserts", async () => {
    const inserted: Record<string, unknown>[] = [];
    const client = {
      from() {
        return {
          insert(row: Record<string, unknown>) {
            inserted.push(row);
            if (inserted.length > 1) {
              return { error: { code: "23505", message: "duplicate key" } };
            }
            return { error: null };
          },
        };
      },
    };
    const repo = new SupabaseLearningTaskRepository(client as never);
    await repo.saveGeneratedTask({
      task: sampleTask("dup-task"),
      assignment: { userId: "user-a", sessionId: "session-1" },
    });
    let caught: { code?: string } | undefined;
    try {
      await repo.saveGeneratedTask({
        task: sampleTask("dup-task"),
        assignment: { userId: "user-b", sessionId: "session-2" },
      });
    } catch (error) {
      caught = error as { code?: string };
    }
    expect(caught?.code).toBe("23505");
    expect(inserted).toHaveLength(2);
    const source = readFileSync(
      path.join(process.cwd(), "src/server/tasks/supabase-learning-task-repository.ts"),
      "utf8",
    );
    expect(source).toContain(".insert(");
    expect(source).not.toMatch(/upsert|onConflict/i);
    const memory = readFileSync(
      path.join(process.cwd(), "src/server/tasks/in-memory-learning-task-repository.ts"),
      "utf8",
    );
    expect(memory).toContain('code: "23505"');
    expect(memory).not.toMatch(/this\.tasks\.set\([\s\S]*overwrite|upsert/i);
  });
});
