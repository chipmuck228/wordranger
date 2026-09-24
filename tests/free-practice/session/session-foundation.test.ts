import { describe, expect, it, vi } from "vitest";
import { createTestFreePracticeSessionReader } from "@/server/free-practice/identity/test-session-reader";
import { FREE_PRACTICE_ORCHESTRATION_TYPE } from "@/server/free-practice/session/constants";
import { FreePracticeSessionController } from "@/server/free-practice/session/controller";
import { parseFreePracticeRecord } from "@/server/free-practice/session/state";
import { assertSafePublicPayload } from "@/server/free-practice/session/public-payload";
import { toTaskGenerationProjection } from "@/server/free-practice/session/to-task-generation-projection";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import {
  createSessionHarness,
  TEST_IDENTITY_ENV,
  unseenLexemes,
  USER_A,
  USER_B,
  V1_PLACEHOLDER_USER_ID,
} from "./helpers";

describe("Free Practice Slice 3A session foundation", () => {
  it("A. UNSEEN READY pins 10 items, issues one task, and does not call the Scheduler", async () => {
    const planSpy = vi.spyOn(
      await import("@/server/scheduler/plan-learning-session"),
      "planLearningSession",
    );
    const evidenceSpy = vi.spyOn(
      await import("@/domain/learning/engine/process-evidence"),
      "processEvidence",
    );
    const submitSpy = vi.spyOn(
      await import("@/server/tasks/submit-task-action"),
      "submitTaskAction",
    );
    const { controller, sessions, tasks } = createSessionHarness({
      lexemes: unseenLexemes(100),
    });
    const result = await controller.start({
      source: "UNSEEN",
      requestedCount: 10,
      userId: "client-forged",
    });
    expect(result.status).toBe("STARTED");
    if (result.status !== "STARTED") {
      return;
    }
    expect(result.session.plannedCount).toBe(10);
    expect(result.session.requestedCount).toBe(10);
    expect(result.session.current).toBe(1);
    expect(result.session.presentationGameType).toBe("RANGER_TRIAL");
    expect(result.task.learningNeedId).toBeTruthy();
    expect(sessions.count()).toBe(1);
    expect(tasks.listTaskIds()).toHaveLength(1);
    expect(planSpy).not.toHaveBeenCalled();
    expect(evidenceSpy).not.toHaveBeenCalled();
    expect(submitSpy).not.toHaveBeenCalled();
    assertSafePublicPayload(result);
    evidenceSpy.mockRestore();
    submitSpy.mockRestore();
    const stored = await sessions.get(result.session.sessionId, USER_A);
    expect(stored?.state.items).toHaveLength(10);
    expect(JSON.stringify(stored?.state)).not.toMatch(
      /reason|priority|LearningSessionPlan|answerKey/,
    );
    planSpy.mockRestore();
  });

  it("B. PARTIAL recently incorrect uses plannedCount 3 as the public denominator", async () => {
    const lexemes = unseenLexemes(20);
    const { controller, sessions } = createSessionHarness({
      lexemes,
      incorrectLexemeIds: lexemes.slice(0, 3).map((lexeme) => lexeme.id),
    });
    const result = await controller.start({
      source: "RECENTLY_INCORRECT",
      requestedCount: 10,
    });
    expect(result.status).toBe("STARTED");
    if (result.status !== "STARTED") {
      return;
    }
    expect(result.session.plannedCount).toBe(3);
    expect(result.session.requestedCount).toBe(10);
    expect(result.session.current).toBe(1);
    expect(sessions.count()).toBe(1);
    expect(result.session.plannedCount).not.toBe(10);
  });

  it("C. EMPTY creates no game_sessions row and no task", async () => {
    const { controller, sessions, tasks } = createSessionHarness({
      lexemes: unseenLexemes(3),
      incorrectLexemeIds: [],
    });
    const result = await controller.start({
      source: "RECENTLY_INCORRECT",
      requestedCount: 5,
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      reason: "NO_ELIGIBLE_WORDS",
    });
    expect(sessions.count()).toBe(0);
    expect(tasks.listTaskIds()).toHaveLength(0);
    assertSafePublicPayload(result);
  });

  it("D. projection routing stays local and is never persisted or public", async () => {
    expect(
      toTaskGenerationProjection({
        id: "item-1",
        lexemeId: "lex-001",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        source: "UNSEEN",
      }),
    ).toMatchObject({
      id: "item-1",
      lexemeId: "lex-001",
      targetSkill: VocabularySkill.MEANING_RECOGNITION,
      reason: "NEW_WORD",
      priority: 0,
    });
    expect(
      toTaskGenerationProjection({
        id: "item-2",
        lexemeId: "lex-002",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        source: "RECENTLY_INCORRECT",
      }).reason,
    ).toBe("STAGE_PROGRESS");

    const unseen = createSessionHarness({ lexemes: unseenLexemes(8) });
    const unseenResult = await unseen.controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(unseenResult.status).toBe("STARTED");
    if (unseenResult.status === "STARTED") {
      expect(unseenResult.task.learningNeedId).toMatch(/^id-/);
      expect(JSON.stringify(unseenResult)).not.toContain("NEW_WORD");
      expect(JSON.stringify(unseenResult)).not.toContain("STAGE_PROGRESS");
      const stored = await unseen.sessions.get(
        unseenResult.session.sessionId,
        USER_A,
      );
      expect(JSON.stringify(stored)).not.toContain("NEW_WORD");
      expect(JSON.stringify(stored)).not.toContain('"reason"');
      expect(JSON.stringify(stored)).not.toContain('"priority"');
    }

    const recentLexemes = unseenLexemes(8);
    const recent = createSessionHarness({
      lexemes: recentLexemes,
      incorrectLexemeIds: recentLexemes.slice(0, 2).map((lexeme) => lexeme.id),
    });
    const recentResult = await recent.controller.start({
      source: "RECENTLY_INCORRECT",
      requestedCount: 5,
    });
    expect(recentResult.status).toBe("STARTED");
    if (recentResult.status === "STARTED") {
      expect(JSON.stringify(recentResult)).not.toContain("STAGE_PROGRESS");
    }
  });

  it("E. resume returns the same revision, item, and taskId", async () => {
    const { controller } = createSessionHarness({ lexemes: unseenLexemes(12) });
    const started = await controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(started.status).toBe("STARTED");
    if (started.status !== "STARTED") {
      return;
    }
    const resumed = await controller.load(started.session.sessionId, {
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(resumed.status).toBe("RESUMED");
    if (resumed.status !== "RESUMED") {
      return;
    }
    expect(resumed.session.revision).toBe(started.session.revision);
    expect(resumed.session.currentTaskId).toBe(started.session.currentTaskId);
    expect(resumed.task.id).toBe(started.task.id);
    expect(resumed.session.current).toBe(1);
    assertSafePublicPayload(resumed);
  });

  it("F. user B cannot load user A session; missing and foreign look the same", async () => {
    const a = createSessionHarness({ userId: USER_A, lexemes: unseenLexemes(8) });
    const started = await a.controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(started.status).toBe("STARTED");
    if (started.status !== "STARTED") {
      return;
    }
    const b = new FreePracticeSessionController({
      vocabulary: a.vocabulary,
      read: a.read,
      tasks: a.tasks,
      sessions: a.sessions,
      learning: a.learning,
      readSession: createTestFreePracticeSessionReader({
        env: TEST_IDENTITY_ENV,
        userId: USER_B,
        isAnonymous: true,
      }),
      env: TEST_IDENTITY_ENV,
    });
    const foreign = await b.load(started.session.sessionId);
    const missing = await b.load("00000000-0000-4000-8000-000000000099");
    expect(foreign).toEqual({ status: "NOT_FOUND" });
    expect(missing).toEqual({ status: "NOT_FOUND" });
  });

  it("rejects placeholder identity and ignores injected userId", async () => {
    const harness = createSessionHarness({
      userId: V1_PLACEHOLDER_USER_ID,
      lexemes: unseenLexemes(8),
    });
    const result = await harness.controller.start({
      source: "UNSEEN",
      requestedCount: 5,
      userId: USER_A,
    });
    expect(result).toEqual({
      status: "UNAVAILABLE",
      reason: "PLACEHOLDER_FORBIDDEN",
    });
    expect(harness.sessions.count()).toBe(0);
  });

  it("G. stale revision is rejected and concurrent first-task issue keeps one assignment", async () => {
    const { controller, sessions } = createSessionHarness({
      lexemes: unseenLexemes(8),
    });
    const started = await controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(started.status).toBe("STARTED");
    if (started.status !== "STARTED") {
      return;
    }
    const stored = await sessions.get(started.session.sessionId, USER_A);
    expect(stored).toBeTruthy();
    if (!stored) {
      return;
    }
    stored.revision = 0;
    await expect(sessions.save(stored)).rejects.toMatchObject({
      code: "SESSION_CONFLICT",
    });

    const fresh = createSessionHarness({ lexemes: unseenLexemes(8) });
    const created = await fresh.sessions.create({
      sessionId: "session-race",
      userId: USER_A,
      planId: "fp-plan:session-race",
      revision: 0,
      state: {
        schemaVersion: "fp-session-v2",
        source: "UNSEEN",
        requestedCount: 5,
        plannedCount: 2,
        items: [
          {
            id: "item-a",
            lexemeId: "lex-001",
            targetSkill: "MEANING_RECOGNITION" as never,
            source: "UNSEEN",
          },
          {
            id: "item-b",
            lexemeId: "lex-002",
            targetSkill: "MEANING_RECOGNITION" as never,
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
      },
    });
    const other = new FreePracticeSessionController({
      vocabulary: fresh.vocabulary,
      read: fresh.read,
      tasks: fresh.tasks,
      sessions: fresh.sessions,
      learning: fresh.learning,
      readSession: createTestFreePracticeSessionReader({
        env: TEST_IDENTITY_ENV,
        userId: USER_A,
        isAnonymous: true,
      }),
      env: TEST_IDENTITY_ENV,
      now: () => "2026-09-24T02:00:00.000Z",
    });
    const [first, second] = await Promise.all([
      fresh.controller.load(created.sessionId),
      other.load(created.sessionId),
    ]);
    expect(first.status).toBe("RESUMED");
    expect(second.status).toBe("RESUMED");
    if (first.status !== "RESUMED" || second.status !== "RESUMED") {
      return;
    }
    expect(first.task.id).toBe(second.task.id);
    const latest = await fresh.sessions.get(created.sessionId, USER_A);
    expect(latest?.state.currentTaskId).toBe(first.task.id);
    expect(latest?.state.assignedItemId).toBe("item-a");
    expect(fresh.tasks.listTaskIds()).toEqual([first.task.id]);
  });

  it("H. parser rejects unknown schema, bad counts, and forbidden persisted fields", () => {
    const base = {
      sessionId: "s1",
      userId: USER_A,
      gameType: FREE_PRACTICE_ORCHESTRATION_TYPE,
      expectedGameType: FREE_PRACTICE_ORCHESTRATION_TYPE,
      expectedUserId: USER_A,
      planId: "fp-plan:s1",
      revision: 0,
    };
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: { schemaVersion: "v2" },
      }),
    ).toThrow(/valid Free Practice record/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        gameType: "DAILY_TRAINING",
        state: { schemaVersion: "fp-session-v1" },
      }),
    ).toThrow(/not a Free Practice/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: {
          schemaVersion: "fp-session-v1",
          source: "UNSEEN",
          requestedCount: 5,
          plannedCount: 1,
          items: [
            {
              id: "a",
              lexemeId: "lex-1",
              targetSkill: "MEANING_RECOGNITION",
              source: "UNSEEN",
            },
          ],
          currentIndex: 0,
          assignedItemId: null,
          currentTaskId: null,
          status: "active",
          createdAt: "now",
        },
      }),
    ).toThrow(/Legacy fp-session-v1 is not accepted/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: {
          schemaVersion: "fp-session-v2",
          source: "UNSEEN",
          requestedCount: 5,
          plannedCount: 2,
          items: [
            {
              id: "a",
              lexemeId: "lex-1",
              targetSkill: "MEANING_RECOGNITION",
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
          createdAt: "now",
          completedAt: null,
        },
      }),
    ).toThrow(/plannedCount/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: {
          schemaVersion: "fp-session-v2",
          source: "UNSEEN",
          requestedCount: 5,
          plannedCount: 1,
          items: [
            {
              id: "a",
              lexemeId: "lex-1",
              targetSkill: "MEANING_RECOGNITION",
              source: "UNSEEN",
              reason: "NEW_WORD",
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
          createdAt: "now",
          completedAt: null,
        },
      }),
    ).toThrow(/must not persist reason/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: {
          schemaVersion: "fp-session-v2",
          source: "UNSEEN",
          requestedCount: 5,
          plannedCount: 2,
          items: [
            {
              id: "a",
              lexemeId: "lex-1",
              targetSkill: "MEANING_RECOGNITION",
              source: "UNSEEN",
            },
            {
              id: "a",
              lexemeId: "lex-2",
              targetSkill: "MEANING_RECOGNITION",
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
          createdAt: "now",
          completedAt: null,
        },
      }),
    ).toThrow(/Duplicate Free Practice item id/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: {
          schemaVersion: "fp-session-v2",
          source: "UNSEEN",
          requestedCount: 5,
          plannedCount: 2,
          items: [
            {
              id: "a",
              lexemeId: "lex-1",
              targetSkill: "MEANING_RECOGNITION",
              source: "UNSEEN",
            },
            {
              id: "b",
              lexemeId: "lex-1",
              targetSkill: "MEANING_RECOGNITION",
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
          createdAt: "now",
          completedAt: null,
        },
      }),
    ).toThrow(/Duplicate Free Practice lexeme id/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: {
          schemaVersion: "fp-session-v2",
          source: "UNSEEN",
          requestedCount: 5,
          plannedCount: 1,
          items: [
            {
              id: "a",
              lexemeId: "lex-1",
              targetSkill: "MEANING_RECOGNITION",
              source: "UNSEEN",
            },
          ],
          currentIndex: 1,
          assignedItemId: null,
          currentTaskId: null,
          phase: "AWAITING_ACTION",
          attempted: 0,
          correct: 0,
          lastCompletedTaskId: null,
          feedback: null,
          createdAt: "now",
          completedAt: null,
        },
      }),
    ).toThrow(/currentIndex is out of range/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: {
          schemaVersion: "fp-session-v2",
          source: "UNSEEN",
          requestedCount: 5,
          plannedCount: 1,
          items: [
            {
              id: "a",
              lexemeId: "lex-1",
              targetSkill: "MEANING_RECOGNITION",
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
          createdAt: "now",
          completedAt: null,
          answerKey: { taskId: "t1", correctOptionIds: ["opt-1"] },
        },
      }),
    ).toThrow(/must not persist answerKey/);
  });

  it("J. public DTO and persisted state omit secrets and future items", async () => {
    const { controller, sessions } = createSessionHarness({
      lexemes: unseenLexemes(12),
    });
    const result = await controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(result.status).toBe("STARTED");
    if (result.status !== "STARTED") {
      return;
    }
    assertSafePublicPayload(result);
    expect(JSON.stringify(result)).not.toContain(USER_A);
    const stored = await sessions.get(result.session.sessionId, USER_A);
    const persisted = JSON.stringify(stored?.state);
    expect(persisted).not.toMatch(/answerKey|correctOptionIds|NEW_WORD|STAGE_PROGRESS|LearningSessionPlan/);
    expect(stored?.state.items).toHaveLength(5);
    expect(result).not.toHaveProperty("items");
  });
});
