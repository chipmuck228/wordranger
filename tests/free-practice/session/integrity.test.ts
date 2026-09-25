import { describe, expect, it } from "vitest";
import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { GeneratedLearningTask } from "@/domain/tasks/generated-learning-task";
import type { LearningTaskRepository } from "@/domain/tasks/learning-task-repository";
import type {
  AssignedLearningTask,
  SaveGeneratedTaskInput,
} from "@/domain/tasks/task-assignment";
import { LearningTaskType, TASK_GENERATOR_VERSION, TASK_PROTOCOL_VERSION } from "@/domain/tasks/task-type";
import { createTestFreePracticeSessionReader } from "@/server/free-practice/identity/test-session-reader";
import { FreePracticeSessionController } from "@/server/free-practice/session/controller";
import { InMemoryFreePracticeSessionStore } from "@/server/free-practice/session/in-memory-store";
import {
  parseFreePracticeRecord,
  serializeFreePracticeState,
} from "@/server/free-practice/session/state";
import { SupabaseFreePracticeSessionStore } from "@/server/free-practice/session/supabase-store";
import type { FreePracticeSessionRecord } from "@/server/free-practice/session/types";
import { InMemoryLearningTaskRepository } from "@/server/tasks/in-memory-learning-task-repository";
import { FREE_PRACTICE_ORCHESTRATION_TYPE } from "@/server/free-practice/session/constants";
import {
  createSessionHarness,
  TEST_IDENTITY_ENV,
  unseenLexemes,
  USER_A,
} from "./helpers";

class UniqueRaceLearningTaskRepository implements LearningTaskRepository {
  readonly inner = new InMemoryLearningTaskRepository();
  saveAttempts = 0;
  uniqueViolations = 0;

  async saveGeneratedTask(input: SaveGeneratedTaskInput): Promise<void> {
    this.saveAttempts += 1;
    const existing = await this.inner.getTaskForEvaluation({
      taskId: input.task.publicTask.id,
      userId: input.assignment.userId,
      sessionId: input.assignment.sessionId,
    });
    if (existing) {
      this.uniqueViolations += 1;
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    await Promise.resolve();
    const raced = await this.inner.getTaskForEvaluation({
      taskId: input.task.publicTask.id,
      userId: input.assignment.userId,
      sessionId: input.assignment.sessionId,
    });
    if (raced) {
      this.uniqueViolations += 1;
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    }
    await this.inner.saveGeneratedTask(input);
  }

  getTaskForEvaluation(
    lookup: Parameters<LearningTaskRepository["getTaskForEvaluation"]>[0],
  ): Promise<AssignedLearningTask | null> {
    return this.inner.getTaskForEvaluation(lookup);
  }

  listTaskIds(): string[] {
    return this.inner.listTaskIds();
  }
}

function validState(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "fp-session-v2",
    source: "UNSEEN",
    requestedCount: 5,
    plannedCount: 2,
    items: [
      {
        id: "item-a",
        lexemeId: "lex-001",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        source: "UNSEEN",
      },
      {
        id: "item-b",
        lexemeId: "lex-002",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        source: "UNSEEN",
      },
    ],
    currentIndex: 0,
    assignedItemId: null,
    currentTaskId: null,
    phase: "AWAITING_ACTION",
    attempted: 0,
    correct: 0,
    lastCompletedTaskId: null,
    feedback: null,
    createdAt: "2026-09-24T02:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function recordFor(
  state: ReturnType<typeof validState>,
  sessionId = "session-integrity",
): FreePracticeSessionRecord {
  return {
    sessionId,
    userId: USER_A,
    planId: `fp-plan:${sessionId}`,
    revision: 0,
    state: state as FreePracticeSessionRecord["state"],
  };
}

function parseBase(state: unknown) {
  return parseFreePracticeRecord({
    sessionId: "s1",
    userId: USER_A,
    gameType: FREE_PRACTICE_ORCHESTRATION_TYPE,
    expectedGameType: FREE_PRACTICE_ORCHESTRATION_TYPE,
    expectedUserId: USER_A,
    planId: "fp-plan:s1",
    revision: 0,
    state,
  });
}

function sampleGeneratedTask(overrides: {
  id?: string;
  learningNeedId?: string;
  lexemeId?: string;
  targetSkill?: VocabularySkill;
}): GeneratedLearningTask {
  const id = overrides.id ?? "task-1";
  return {
    publicTask: {
      id,
      protocolVersion: TASK_PROTOCOL_VERSION,
      generatorVersion: TASK_GENERATOR_VERSION,
      learningNeedId: overrides.learningNeedId ?? "item-a",
      lexemeId: overrides.lexemeId ?? "lex-001",
      targetSkill: overrides.targetSkill ?? VocabularySkill.MEANING_RECOGNITION,
      taskType: LearningTaskType.MEANING_CHOICE,
      promptMode: PromptMode.WORD_TO_MEANING,
      answerMode: AnswerMode.MULTIPLE_CHOICE,
      difficulty: 0.45,
      prompt: { kind: "LEXEME_TEXT", text: "word1" },
      responseContract: {
        kind: "CHOICE",
        options: [{ id: "opt-1", content: { kind: "TEXT", text: "意思1" } }],
      },
      hints: [],
      createdAt: "2026-09-24T02:00:00.000Z",
    },
    answerKey: {
      taskId: id,
      targetLexemeId: overrides.lexemeId ?? "lex-001",
      correctOptionIds: ["opt-1"],
      optionLexemeIds: { "opt-1": "lex-001" },
      exactAcceptedTexts: [],
      semanticAcceptedTexts: [],
    },
    generationTrace: {
      generatorVersion: TASK_GENERATOR_VERSION,
      archetype: LearningTaskType.MEANING_CHOICE,
      targetLexemeId: overrides.lexemeId ?? "lex-001",
      candidateLexemeIds: [],
      selectedDistractorLexemeIds: [],
      relationIds: [],
      blockedCandidates: [],
      policyVersion: "v1",
    },
  };
}

class RecordingGameSessionClient {
  readonly rows = new Map<string, Record<string, unknown>>();
  readonly actions: string[] = [];

  from = () => {
    const rows = this.rows;
    const actions = this.actions;
    return {
      insert: (payload: Record<string, unknown>) => {
        actions.push("insert");
        rows.set(String(payload.id), { ...payload });
        return Promise.resolve({ data: payload, error: null });
      },
      select: () => ({
        eq() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
      }),
      update: () => ({
        eq() {
          return this;
        },
        select() {
          return {
            maybeSingle() {
              actions.push("update");
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      }),
    };
  };

  asClient() {
    return this as never;
  }
}

describe("Free Practice session association and write-time integrity", () => {
  it("B. rejects assigned/task pair and source mismatches", () => {
    expect(() =>
      parseBase(validState({ assignedItemId: "item-a", currentTaskId: null })),
    ).toThrow(/both null or both set/);
    expect(() =>
      parseBase(validState({ assignedItemId: null, currentTaskId: "task-1" })),
    ).toThrow(/both null or both set/);
    expect(() =>
      parseBase(
        validState({
          assignedItemId: "item-b",
          currentTaskId: "task-1",
        }),
      ),
    ).toThrow(/assignedItemId must equal items\[currentIndex\]\.id/);
    expect(() =>
      parseBase(
        validState({
          items: [
            {
              id: "item-a",
              lexemeId: "lex-001",
              targetSkill: VocabularySkill.MEANING_RECOGNITION,
              source: "RECENTLY_INCORRECT",
            },
            {
              id: "item-b",
              lexemeId: "lex-002",
              targetSkill: VocabularySkill.MEANING_RECOGNITION,
              source: "UNSEEN",
            },
          ],
        }),
      ),
    ).toThrow(/item source must match session source/);
  });

  it("C. mismatched assigned tasks cannot resume and do not rewrite session", async () => {
    const cases: Array<{
      label: string;
      task: GeneratedLearningTask;
      assignment?: { userId: string; sessionId: string };
    }> = [
      {
        label: "learningNeedId",
        task: sampleGeneratedTask({ learningNeedId: "other-item" }),
      },
      {
        label: "lexemeId",
        task: sampleGeneratedTask({ lexemeId: "lex-999" }),
      },
      {
        label: "targetSkill",
        task: sampleGeneratedTask({
          targetSkill: VocabularySkill.ACTIVE_RECALL,
        }),
      },
      {
        label: "user",
        task: sampleGeneratedTask({}),
        assignment: { userId: "user-b", sessionId: "session-integrity" },
      },
      {
        label: "session",
        task: sampleGeneratedTask({}),
        assignment: { userId: USER_A, sessionId: "other-session" },
      },
    ];

    for (const testCase of cases) {
      const harness = createSessionHarness({ lexemes: unseenLexemes(8) });
      const created = await harness.sessions.create(
        recordFor(
          validState({
            assignedItemId: "item-a",
            currentTaskId: "task-1",
          }),
        ),
      );
      await harness.tasks.saveGeneratedTask({
        task: testCase.task,
        assignment: testCase.assignment ?? {
          userId: USER_A,
          sessionId: created.sessionId,
        },
      });
      const resumed = await harness.controller.load(created.sessionId);
      expect(resumed.status, testCase.label).toBe("NOT_FOUND");
      const stored = await harness.sessions.get(created.sessionId, USER_A);
      expect(stored?.state.currentTaskId).toBe("task-1");
      expect(stored?.state.assignedItemId).toBe("item-a");
    }
  });

  it("D. memory and Supabase stores validate before persist", async () => {
    const memory = new InMemoryFreePracticeSessionStore();
    await expect(
      memory.create(recordFor(validState({ plannedCount: 9 }))),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(memory.count()).toBe(0);
    await expect(
      memory.create(recordFor(validState({ currentIndex: 4 }))),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(memory.count()).toBe(0);
    await expect(
      memory.create(
        recordFor(validState({ assignedItemId: "item-a", currentTaskId: null })),
      ),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(memory.count()).toBe(0);
    expect(() =>
      serializeFreePracticeState(
        recordFor(
          validState({
            items: [
              {
                id: "item-a",
                lexemeId: "lex-001",
                targetSkill: VocabularySkill.MEANING_RECOGNITION,
                source: "UNSEEN",
                reason: "NEW_WORD",
              },
            ],
            plannedCount: 1,
          }),
        ),
      ),
    ).toThrow(/must not persist reason/);

    const created = await memory.create(recordFor(validState(), "session-ok"));
    await expect(
      memory.save({
        ...created,
        state: {
          ...created.state,
          assignedItemId: "item-a",
          currentTaskId: null,
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    const loaded = await memory.get("session-ok", USER_A);
    expect(loaded?.state.currentTaskId).toBeNull();
    expect(loaded?.state.assignedItemId).toBeNull();

    const fake = new RecordingGameSessionClient();
    const supabase = new SupabaseFreePracticeSessionStore(fake.asClient());
    await expect(
      supabase.create(recordFor(validState({ plannedCount: 9 }))),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(fake.actions).toEqual([]);
    const valid = await supabase.create(recordFor(validState(), "session-sb"));
    expect(fake.actions).toEqual(["insert"]);
    await expect(
      supabase.save({
        ...valid,
        state: {
          ...valid.state,
          assignedItemId: null,
          currentTaskId: "task-1",
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(fake.actions).toEqual(["insert"]);
  });

  it("A. concurrent first-task issue through a unique-race repository keeps one task", async () => {
    const tasks = new UniqueRaceLearningTaskRepository();
    const sessions = new InMemoryFreePracticeSessionStore();
    const harness = createSessionHarness({
      lexemes: unseenLexemes(8),
      tasks: tasks as never,
      sessions,
    });
    const created = await sessions.create(
      recordFor(validState(), "session-race"),
    );
    const other = new FreePracticeSessionController({
      vocabulary: harness.vocabulary,
      read: harness.read,
      tasks,
      sessions,
      learning: harness.learning,
      readSession: createTestFreePracticeSessionReader({
        env: TEST_IDENTITY_ENV,
        userId: USER_A,
        isAnonymous: true,
      }),
      env: TEST_IDENTITY_ENV,
      now: () => "2026-09-24T02:00:00.000Z",
    });
    const [first, second] = await Promise.all([
      harness.controller.load(created.sessionId),
      other.load(created.sessionId),
    ]);
    expect(first.status).toBe("RESUMED");
    expect(second.status).toBe("RESUMED");
    if (first.status !== "RESUMED" || second.status !== "RESUMED") {
      return;
    }
    expect(first.task.id).toBe(second.task.id);
    const stored = await sessions.get(created.sessionId, USER_A);
    expect(stored?.state.currentTaskId).toBe(first.task.id);
    expect(tasks.listTaskIds()).toEqual([first.task.id]);
    expect(tasks.listTaskIds()).toHaveLength(1);
  });
});
