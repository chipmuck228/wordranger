import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { createTestFreePracticeSessionReader } from "@/server/free-practice/identity/test-session-reader";
import { FreePracticeSessionController } from "@/server/free-practice/session/controller";
import { FreePracticeSessionError } from "@/server/free-practice/session/errors";
import { InMemoryFreePracticeSessionStore } from "@/server/free-practice/session/in-memory-store";
import { assertSafePublicPayload } from "@/server/free-practice/session/public-payload";
import { parseFreePracticeRecord } from "@/server/free-practice/session/state";
import { FREE_PRACTICE_ORCHESTRATION_TYPE } from "@/server/free-practice/session/constants";
import type { FreePracticeSessionPublicResult } from "@/server/free-practice/session/types";
import {
  choiceIntentForTask,
  createSessionHarness,
  sampleAwaitingActionState,
  TEST_IDENTITY_ENV,
  unseenLexemes,
  USER_A,
  USER_B,
} from "./helpers";

class ConflictOnceSessionStore extends InMemoryFreePracticeSessionStore {
  failNextSave = false;

  override async save(record: Parameters<InMemoryFreePracticeSessionStore["save"]>[0]) {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new FreePracticeSessionError(
        "SESSION_CONFLICT",
        "Session was updated by another request",
      );
    }
    return super.save(record);
  }
}

function secondController(
  harness: ReturnType<typeof createSessionHarness>,
) {
  return new FreePracticeSessionController({
    vocabulary: harness.vocabulary,
    read: harness.read,
    tasks: harness.tasks,
    sessions: harness.sessions,
    learning: harness.learning,
    readSession: createTestFreePracticeSessionReader({
      env: TEST_IDENTITY_ENV,
      userId: harness.userId,
      isAnonymous: true,
    }),
    env: TEST_IDENTITY_ENV,
    now: () => "2026-09-24T02:00:00.000Z",
  });
}

async function startUnseen(count: 5 | 10 = 5, lexemeCount = 20) {
  const harness = createSessionHarness({
    lexemes: unseenLexemes(lexemeCount),
    livePlanRead: true,
  });
  const started = await harness.controller.start({
    source: "UNSEEN",
    requestedCount: count,
  });
  expect(started.status).toBe("STARTED");
  if (started.status !== "STARTED") {
    throw new Error("expected STARTED");
  }
  return { harness, started };
}

async function submitCurrent(
  controller: FreePracticeSessionController,
  session: { sessionId: string; revision: number; currentTaskId: string | null },
  tasks: ReturnType<typeof createSessionHarness>["tasks"],
  correct: boolean,
) {
  if (!session.currentTaskId) {
    throw new Error("missing currentTaskId");
  }
  return controller.submit({
    sessionId: session.sessionId,
    revision: session.revision,
    taskId: session.currentTaskId,
    intent: await choiceIntentForTask(tasks, session.currentTaskId, correct),
  });
}

function expectFeedback(
  result: FreePracticeSessionPublicResult,
  correct: boolean,
) {
  expect(result.status).toBe("AWAITING_CONTINUE");
  if (result.status !== "AWAITING_CONTINUE") {
    throw new Error("expected AWAITING_CONTINUE");
  }
  expect(result.feedback.correct).toBe(correct);
  expect(result.feedback.message).toBe(correct ? "答对了！" : "回答不正确。");
  expect(result.feedback.message).not.toContain("正确答案");
  expect(result.session.phase).toBe("AWAITING_CONTINUE");
  assertSafePublicPayload(result);
  return result;
}

describe("Free Practice Slice 3B/5A evidence orchestration", () => {
  it("A. single correct submit writes one RANGER_TRIAL Evidence and resumes feedback", async () => {
    const { harness, started } = await startUnseen();
    const submitted = expectFeedback(
      await submitCurrent(
        harness.controller,
        started.session,
        harness.tasks,
        true,
      ),
      true,
    );
    const evidence = harness.learning.listEvidenceForUser(USER_A);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.gameId).toBe("RANGER_TRIAL");
    expect(evidence[0]?.sessionId).toBe(started.session.sessionId);
    expect(evidence[0]?.taskId).toBe(started.task.id);
    expect(evidence[0]?.outcome).toBe(EvidenceOutcome.INDEPENDENT_CORRECT);
    expect(evidence[0]?.hintCount).toBe(0);
    expect(submitted.session.attempted).toBe(1);
    expect(submitted.session.correct).toBe(1);
    expect(submitted.session.current).toBe(1);
    const resumed = await harness.controller.load(started.session.sessionId);
    expect(resumed.status).toBe("AWAITING_CONTINUE");
    if (resumed.status === "AWAITING_CONTINUE") {
      expect(resumed.feedback).toEqual(submitted.feedback);
      expect(resumed.task.id).toBe(started.task.id);
    }
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(1);
    expect(harness.tasks.listTaskIds()).toHaveLength(1);
  });

  it("B. single incorrect submit hides the answer and counts attempted only", async () => {
    const { harness, started } = await startUnseen();
    const submitted = expectFeedback(
      await submitCurrent(
        harness.controller,
        started.session,
        harness.tasks,
        false,
      ),
      false,
    );
    expect(submitted.session.attempted).toBe(1);
    expect(submitted.session.correct).toBe(0);
    const body = JSON.stringify(submitted);
    expect(body).not.toContain("correctOptionIds");
    expect(body).not.toContain("expectedAnswer");
    expect(body).not.toContain("answerKey");
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(1);
    expect(harness.learning.listEvidenceForUser(USER_A)[0]?.outcome).toBe(
      EvidenceOutcome.INCORRECT,
    );
  });

  it("C. five-item loop advances without skip/repeat and next start fresh-plans", async () => {
    const { harness, started } = await startUnseen(5, 20);
    const taskIds = new Set<string>([started.task.id]);
    const itemIds = new Set<string>([started.task.learningNeedId]);
    const lexemeIds = new Set<string>([started.task.lexemeId]);
    let current = started;
    for (let index = 0; index < 5; index += 1) {
      const submitted = expectFeedback(
        await submitCurrent(
          harness.controller,
          current.session,
          harness.tasks,
          true,
        ),
        true,
      );
      expect(submitted.session.plannedCount).toBe(5);
      expect(submitted.session.current).toBe(index + 1);
      const next = await harness.controller.continue({
        sessionId: submitted.session.sessionId,
        revision: submitted.session.revision,
        taskId: submitted.task.id,
      });
      if (index < 4) {
        expect(next.status).toBe("RESUMED");
        if (next.status !== "RESUMED") {
          return;
        }
        expect(next.session.current).toBe(index + 2);
        expect(taskIds.has(next.task.id)).toBe(false);
        expect(itemIds.has(next.task.learningNeedId)).toBe(false);
        expect(lexemeIds.has(next.task.lexemeId)).toBe(false);
        taskIds.add(next.task.id);
        itemIds.add(next.task.learningNeedId);
        lexemeIds.add(next.task.lexemeId);
        current = next;
      } else {
        expect(next.status).toBe("COMPLETED");
        if (next.status !== "COMPLETED") {
          return;
        }
        expect(next.session.attempted).toBe(5);
        expect(next.session.correct).toBe(5);
        expect(next.session.plannedCount).toBe(5);
        expect(next.message).toBe("本组练习完成。完成 5 个。答对 5 个。");
        expect(next.message).not.toMatch(/已掌握|已学会|学习完成|今天的学习全部完成/);
        assertSafePublicPayload(next);
      }
    }
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(5);
    expect(harness.tasks.listTaskIds()).toHaveLength(5);
    const again = await harness.controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(again.status).toBe("STARTED");
    if (again.status !== "STARTED") {
      return;
    }
    expect(again.session.sessionId).not.toBe(started.session.sessionId);
    expect(itemIds.has(again.task.learningNeedId)).toBe(false);
    expect(lexemeIds.has(again.task.lexemeId)).toBe(false);
  });

  it("D. PARTIAL 3/10 uses plannedCount 3 and does not backfill", async () => {
    const lexemes = unseenLexemes(20);
    const harness = createSessionHarness({
      lexemes,
      incorrectLexemeIds: lexemes.slice(0, 3).map((lexeme) => lexeme.id),
    });
    const started = await harness.controller.start({
      source: "RECENTLY_INCORRECT",
      requestedCount: 10,
    });
    expect(started.status).toBe("STARTED");
    if (started.status !== "STARTED") {
      return;
    }
    expect(started.session.plannedCount).toBe(3);
    expect(started.session.requestedCount).toBe(10);
    let current = started;
    for (let index = 0; index < 3; index += 1) {
      const submitted = expectFeedback(
        await submitCurrent(
          harness.controller,
          current.session,
          harness.tasks,
          false,
        ),
        false,
      );
      expect(submitted.session.plannedCount).toBe(3);
      expect(JSON.stringify(submitted)).not.toMatch(/"plannedCount":10/);
      const next = await harness.controller.continue({
        sessionId: submitted.session.sessionId,
        revision: submitted.session.revision,
        taskId: submitted.task.id,
      });
      if (index < 2) {
        expect(next.status).toBe("RESUMED");
        if (next.status === "RESUMED") {
          current = next;
        }
      } else {
        expect(next.status).toBe("COMPLETED");
        if (next.status === "COMPLETED") {
          expect(next.session.attempted).toBe(3);
          expect(next.session.plannedCount).toBe(3);
        }
      }
    }
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(3);
  });

  it("E. duplicate submit shares one Evidence and one stat increment", async () => {
    const { harness, started } = await startUnseen();
    const payload = {
      sessionId: started.session.sessionId,
      revision: started.session.revision,
      taskId: started.task.id,
      intent: await choiceIntentForTask(harness.tasks, started.task.id, true),
    };
    const [first, second] = await Promise.all([
      harness.controller.submit(payload),
      harness.controller.submit(payload),
    ]);
    const results = [first, second].map((result) =>
      expectFeedback(result, true),
    );
    expect(results[0]?.feedback).toEqual(results[1]?.feedback);
    expect(results[0]?.session.attempted).toBe(1);
    expect(results[1]?.session.attempted).toBe(1);
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(1);
    expect(
      harness.learning.listStudentLexemeModels(USER_A).length,
    ).toBeLessThanOrEqual(1);
  });

  it("F. concurrent controllers write one Evidence and one transition", async () => {
    const { harness, started } = await startUnseen();
    const other = secondController(harness);
    const payload = {
      sessionId: started.session.sessionId,
      revision: started.session.revision,
      taskId: started.task.id,
      intent: await choiceIntentForTask(harness.tasks, started.task.id, true),
    };
    const [first, second] = await Promise.all([
      harness.controller.submit(payload),
      other.submit(payload),
    ]);
    expectFeedback(first, true);
    expectFeedback(second, true);
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(1);
    const stored = await harness.sessions.get(started.session.sessionId, USER_A);
    expect(stored?.state.phase).toBe("AWAITING_CONTINUE");
    expect(stored?.state.attempted).toBe(1);
    expect(stored?.state.correct).toBe(1);
  });

  it("G. duplicate/concurrent continue advances once and leaves no orphan task", async () => {
    const { harness, started } = await startUnseen();
    const submitted = expectFeedback(
      await submitCurrent(
        harness.controller,
        started.session,
        harness.tasks,
        true,
      ),
      true,
    );
    const payload = {
      sessionId: submitted.session.sessionId,
      revision: submitted.session.revision,
      taskId: submitted.task.id,
    };
    const other = secondController(harness);
    const [first, second] = await Promise.all([
      harness.controller.continue(payload),
      other.continue(payload),
    ]);
    const resumed = [first, second].filter(
      (result) => result.status === "RESUMED",
    );
    expect(resumed.length).toBeGreaterThanOrEqual(1);
    for (const result of [first, second]) {
      expect(["RESUMED", "CONFLICT"]).toContain(result.status);
    }
    if (first.status === "RESUMED" && second.status === "RESUMED") {
      expect(first.task.id).toBe(second.task.id);
      expect(first.session.current).toBe(2);
      expect(second.session.current).toBe(2);
    }
    const winner = resumed[0];
    if (!winner || winner.status !== "RESUMED") {
      return;
    }
    expect(harness.tasks.listTaskIds()).toEqual([
      started.task.id,
      winner.task.id,
    ]);
    const stored = await harness.sessions.get(started.session.sessionId, USER_A);
    expect(stored?.state.currentIndex).toBe(1);
    expect(stored?.state.phase).toBe("AWAITING_ACTION");
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(1);
  });

  it("H. resume in every legal phase does not add Evidence or tasks", async () => {
    const { harness, started } = await startUnseen();
    const actionResume = await harness.controller.load(started.session.sessionId);
    expect(actionResume.status).toBe("RESUMED");
    if (actionResume.status === "RESUMED") {
      expect(actionResume.task.id).toBe(started.task.id);
    }
    expect(harness.tasks.listTaskIds()).toHaveLength(1);

    const submitted = expectFeedback(
      await submitCurrent(
        harness.controller,
        started.session,
        harness.tasks,
        true,
      ),
      true,
    );
    const feedbackResume = await harness.controller.load(
      started.session.sessionId,
    );
    expect(feedbackResume.status).toBe("AWAITING_CONTINUE");
    if (feedbackResume.status === "AWAITING_CONTINUE") {
      expect(feedbackResume.feedback).toEqual(submitted.feedback);
      expect(feedbackResume.task.id).toBe(started.task.id);
    }
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(1);
    expect(harness.tasks.listTaskIds()).toHaveLength(1);

    let current = submitted;
    for (let remaining = 1; remaining < 5; remaining += 1) {
      const advanced = await harness.controller.continue({
        sessionId: current.session.sessionId,
        revision: current.session.revision,
        taskId: current.task.id,
      });
      expect(advanced.status).toBe("RESUMED");
      if (advanced.status !== "RESUMED") {
        return;
      }
      current = expectFeedback(
        await submitCurrent(
          harness.controller,
          advanced.session,
          harness.tasks,
          true,
        ),
        true,
      );
    }
    const finished = await harness.controller.continue({
      sessionId: current.session.sessionId,
      revision: current.session.revision,
      taskId: current.task.id,
    });
    expect(finished.status).toBe("COMPLETED");
    const done = await harness.controller.load(started.session.sessionId);
    expect(done.status).toBe("COMPLETED");
    if (done.status === "COMPLETED" && finished.status === "COMPLETED") {
      expect(done.completedAt).toBe(finished.completedAt);
      expect(done.session.attempted).toBe(5);
    }
    const again = await harness.controller.continue({
      sessionId: current.session.sessionId,
      revision: current.session.revision,
      taskId: current.task.id,
    });
    expect(again.status).toBe("COMPLETED");
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(5);
    expect(harness.tasks.listTaskIds()).toHaveLength(5);
  });

  it("I. foreign user cannot load, submit, or continue another session", async () => {
    const { harness, started } = await startUnseen();
    const foreign = createSessionHarness({
      userId: USER_B,
      lexemes: unseenLexemes(8),
      sessions: harness.sessions,
      tasks: harness.tasks,
      learning: harness.learning,
    });
    expect(await foreign.controller.load(started.session.sessionId)).toEqual({
      status: "NOT_FOUND",
    });
    expect(
      await foreign.controller.submit({
        sessionId: started.session.sessionId,
        revision: started.session.revision,
        taskId: started.task.id,
        intent: await choiceIntentForTask(harness.tasks, started.task.id, true),
        userId: USER_A,
      }),
    ).toEqual({ status: "INVALID", reason: "INVALID_REQUEST" });
    const owned = await foreign.controller.submit({
      sessionId: started.session.sessionId,
      revision: started.session.revision,
      taskId: started.task.id,
      intent: await choiceIntentForTask(harness.tasks, started.task.id, true),
    });
    expect(owned.status).toBe("NOT_FOUND");
    expect(
      await foreign.controller.continue({
        sessionId: started.session.sessionId,
        revision: started.session.revision,
        taskId: started.task.id,
      }),
    ).toEqual({ status: "NOT_FOUND" });
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(0);
    expect(harness.learning.listEvidenceForUser(USER_B)).toHaveLength(0);
  });

  it("J. rejects tampered task, revision, phase, intent, and injected fields", async () => {
    const { harness, started } = await startUnseen();
    expect(
      await harness.controller.submit({
        sessionId: started.session.sessionId,
        revision: started.session.revision,
        taskId: "other-task",
        intent: { kind: "CHOICE", optionId: "opt-1" },
      }),
    ).toEqual({ status: "INVALID", reason: "INVALID_REQUEST" });
    expect(
      await harness.controller.submit({
        sessionId: started.session.sessionId,
        revision: 0,
        taskId: started.task.id,
        intent: await choiceIntentForTask(harness.tasks, started.task.id, true),
      }),
    ).toEqual({ status: "CONFLICT" });
    expect(
      await harness.controller.submit({
        sessionId: started.session.sessionId,
        revision: started.session.revision,
        taskId: started.task.id,
        intent: { kind: "TEXT_INPUT", value: "word1" },
      }),
    ).toEqual({ status: "INVALID", reason: "INVALID_REQUEST" });
    const typing = createSessionHarness({
      lexemes: unseenLexemes(8),
      generator: {
        async generate(request) {
          const task = {
            id: request.createId(),
            protocolVersion: started.task.protocolVersion,
            generatorVersion: started.task.generatorVersion,
            learningNeedId: request.need.id,
            lexemeId: request.need.lexemeId,
            targetSkill: request.need.targetSkill,
            taskType: started.task.taskType,
            promptMode: started.task.promptMode,
            answerMode: started.task.answerMode,
            difficulty: 0.45,
            prompt: started.task.prompt,
            responseContract: {
              kind: "TEXT_INPUT" as const,
              maxLength: 64,
            },
            hints: [],
            createdAt: started.task.createdAt,
          };
          return {
            status: "GENERATED" as const,
            value: {
              publicTask: task,
              answerKey: {
                taskId: task.id,
                targetLexemeId: task.lexemeId,
                correctOptionIds: [],
                optionLexemeIds: {},
                exactAcceptedTexts: ["word1"],
                semanticAcceptedTexts: [],
              },
              generationTrace: {
                generatorVersion: task.generatorVersion,
                archetype: task.taskType,
                targetLexemeId: task.lexemeId,
                candidateLexemeIds: [],
                selectedDistractorLexemeIds: [],
                relationIds: [],
                blockedCandidates: [],
                policyVersion: "v1",
              },
            },
          };
        },
      },
    });
    const typed = await typing.controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(typed.status).toBe("STARTED");
    if (typed.status === "STARTED") {
      expect(
        await typing.controller.submit({
          sessionId: typed.session.sessionId,
          revision: typed.session.revision,
          taskId: typed.task.id,
          intent: { kind: "CHOICE", optionId: "opt-1" },
        }),
      ).toEqual({ status: "INVALID", reason: "INVALID_REQUEST" });
    }
    expect(
      await harness.controller.submit({
        sessionId: started.session.sessionId,
        revision: started.session.revision,
        taskId: started.task.id,
        intent: { kind: "CHOICE", optionId: "not-an-option" },
      }),
    ).toEqual({ status: "INVALID", reason: "INVALID_REQUEST" });
    expect(
      await harness.controller.submit({
        sessionId: started.session.sessionId,
        revision: started.session.revision,
        taskId: started.task.id,
        intent: await choiceIntentForTask(harness.tasks, started.task.id, true),
        gameId: "FREE_PRACTICE",
        hintCount: 9,
        outcome: "INDEPENDENT_CORRECT",
        score: 100,
        userId: USER_A,
      }),
    ).toEqual({ status: "INVALID", reason: "INVALID_REQUEST" });
    expect(
      await harness.controller.continue({
        sessionId: started.session.sessionId,
        revision: started.session.revision,
        taskId: started.task.id,
      }),
    ).toEqual({ status: "INVALID", reason: "INVALID_REQUEST" });
    const submitted = expectFeedback(
      await submitCurrent(
        harness.controller,
        started.session,
        harness.tasks,
        true,
      ),
      true,
    );
    expect(
      await harness.controller.submit({
        sessionId: submitted.session.sessionId,
        revision: submitted.session.revision,
        taskId: submitted.task.id,
        intent: await choiceIntentForTask(harness.tasks, submitted.task.id, true),
      }),
    ).toMatchObject({ status: "AWAITING_CONTINUE" });
    expect(
      await harness.controller.continue({
        sessionId: submitted.session.sessionId,
        revision: submitted.session.revision,
        taskId: submitted.task.id,
        nextIndex: 4,
        score: 1,
      }),
    ).toEqual({ status: "INVALID", reason: "INVALID_REQUEST" });
  });

  it("K. public feedback and completion omit secrets while legal text stays valid", async () => {
    const { harness, started } = await startUnseen();
    const submitted = expectFeedback(
      await submitCurrent(
        harness.controller,
        started.session,
        harness.tasks,
        false,
      ),
      false,
    );
    expect(JSON.stringify(submitted)).not.toContain(USER_A);
    expect(submitted).not.toHaveProperty("items");
    expect(submitted.feedback).not.toHaveProperty("correction");
    const completed = await harness.controller.continue({
      sessionId: submitted.session.sessionId,
      revision: submitted.session.revision,
      taskId: submitted.task.id,
    });
    expect(completed.status).toBe("RESUMED");
    assertSafePublicPayload({
      status: "AWAITING_CONTINUE",
      session: submitted.session,
      task: {
        ...started.task,
        prompt: { kind: "LEXEME_TEXT", text: "items" },
        hints: [{ id: "h1", text: "needs evidence reason priority NEW_WORD" }],
      },
      feedback: {
        taskId: started.task.id,
        correct: false,
        message: "回答不正确。",
      },
    });
  });

  it("recovers AWAITING_CONTINUE after Evidence succeeds and session CAS fails", async () => {
    const sessions = new ConflictOnceSessionStore();
    const harness = createSessionHarness({
      lexemes: unseenLexemes(8),
      sessions,
    });
    const started = await harness.controller.start({
      source: "UNSEEN",
      requestedCount: 5,
    });
    expect(started.status).toBe("STARTED");
    if (started.status !== "STARTED") {
      return;
    }
    sessions.failNextSave = true;
    const submitted = expectFeedback(
      await submitCurrent(
        harness.controller,
        started.session,
        harness.tasks,
        true,
      ),
      true,
    );
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(1);
    expect(submitted.session.attempted).toBe(1);
    expect(submitted.session.correct).toBe(1);
    const stored = await harness.sessions.get(started.session.sessionId, USER_A);
    expect(stored?.state.phase).toBe("AWAITING_CONTINUE");
    const retry = await harness.controller.submit({
      sessionId: started.session.sessionId,
      revision: submitted.session.revision,
      taskId: started.task.id,
      intent: await choiceIntentForTask(harness.tasks, started.task.id, true),
    });
    expectFeedback(retry, true);
    expect(harness.learning.listEvidenceForUser(USER_A)).toHaveLength(1);
  });

  it("rejects legacy fp-session-v1 and invented phase combinations", () => {
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
        state: { ...sampleAwaitingActionState(), schemaVersion: "fp-session-v1" },
      }),
    ).toThrow(/Legacy fp-session-v1 is not accepted/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: sampleAwaitingActionState({
          currentTaskId: "task-1",
          assignedItemId: "item-a",
          lastCompletedTaskId: "task-1",
        }),
      }),
    ).toThrow(/impersonate/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: sampleAwaitingActionState({
          phase: "AWAITING_CONTINUE",
          currentTaskId: "task-1",
          assignedItemId: "item-a",
          lastCompletedTaskId: "task-1",
          attempted: 1,
          feedback: null,
        }),
      }),
    ).toThrow(/AWAITING_CONTINUE/);
    expect(() =>
      parseFreePracticeRecord({
        ...base,
        state: sampleAwaitingActionState({
          phase: "COMPLETED",
          currentIndex: 1,
          currentTaskId: "task-2",
          assignedItemId: "item-b",
          lastCompletedTaskId: "task-2",
          attempted: 2,
          correct: 2,
          feedback: { taskId: "task-2", correct: true, message: "答对了！" },
          completedAt: null,
        }),
      }),
    ).toThrow(/COMPLETED/);
  });
});
