import { describe, expect, it } from "vitest";
import { PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { V1_PLACEHOLDER_USER_ID } from "@/server/auth/v1-user";
import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import {
  assertNoAnswerKeyFields,
  parseRangerTrialSessionRecord,
  serializeRangerTrialState,
} from "@/server/game-session/ranger-trial-session-state";
import { SupabaseRangerTrialSessionStore } from "@/server/game-session/supabase-ranger-trial-session-store";
import type { RangerTrialSessionRecord } from "@/server/game-session/ranger-trial-session.types";
import { ANSWER_KEY_FIELDS, collectKeys } from "../game/helpers";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

function sampleRecord(
  overrides: Partial<RangerTrialSessionRecord> = {},
): RangerTrialSessionRecord {
  return {
    sessionId: SESSION_ID,
    userId: V1_PLACEHOLDER_USER_ID,
    planId: "plan-1",
    createdAt: "2026-09-16T12:00:00.000Z",
    needs: [
      {
        id: "need-1",
        lexemeId: "lex-1",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
        priority: 1,
        reason: "NEW_WORD",
        preferredPromptModes: [PromptMode.WORD_TO_MEANING],
        avoidRecentTaskTypes: [],
      },
    ],
    currentNeedIndex: 0,
    currentTaskId: "task-1",
    phase: "awaiting_action",
    completed: 0,
    stats: { attempted: 0, correct: 0, incorrect: 0 },
    lastFeedback: null,
    lastCompletedTaskId: null,
    generationFailures: [],
    recentTasks: [{ taskId: "task-1", taskType: "MEANING_CHOICE", lexemeId: "lex-1" }],
    ...overrides,
  };
}

function createFakeClient(seed?: Map<string, Record<string, unknown>>) {
  const rows = seed ?? new Map<string, Record<string, unknown>>();
  return {
    rows,
    from(table: string) {
      if (table !== "game_sessions") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        upsert: async (payload: Record<string, unknown>) => {
          const existing = rows.get(String(payload.id));
          rows.set(String(payload.id), {
            ...existing,
            ...payload,
            created_at: existing?.created_at ?? payload.created_at,
          });
          return { error: null };
        },
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => ({
              data: rows.get(id) ?? null,
              error: null,
            }),
          }),
        }),
      };
    },
  };
}

describe("game_sessions Ranger Trial store", () => {
  it("P1: save session then load the same session", async () => {
    const client = createFakeClient();
    const store = new SupabaseRangerTrialSessionStore(
      client as never,
      V1_PLACEHOLDER_USER_ID,
    );
    const record = sampleRecord();
    await store.save(record);
    const loaded = await store.get(record.sessionId);
    expect(loaded).toEqual(record);
  });

  it("P2: update phase then reload the updated phase", async () => {
    const client = createFakeClient();
    const store = new SupabaseRangerTrialSessionStore(
      client as never,
      V1_PLACEHOLDER_USER_ID,
    );
    await store.save(sampleRecord());
    await store.save(
      sampleRecord({
        phase: "awaiting_continue",
        lastFeedback: {
          status: "CORRECT",
          message: "答对了！",
          continueAvailable: true,
        },
        lastCompletedTaskId: "task-1",
        completed: 1,
        stats: { attempted: 1, correct: 1, incorrect: 0 },
      }),
    );
    const loaded = await store.get(SESSION_ID);
    expect(loaded?.phase).toBe("awaiting_continue");
    expect(loaded?.lastFeedback?.status).toBe("CORRECT");
  });

  it("P3: completed session survives reload", async () => {
    const client = createFakeClient();
    const store = new SupabaseRangerTrialSessionStore(
      client as never,
      V1_PLACEHOLDER_USER_ID,
    );
    await store.save(
      sampleRecord({
        phase: "completed",
        currentNeedIndex: 1,
        currentTaskId: null,
        completed: 1,
      }),
    );
    const loaded = await store.get(SESSION_ID);
    expect(loaded?.phase).toBe("completed");
  });

  it("P4: persisted state contains no AnswerKey fields", async () => {
    const record = sampleRecord({
      lastFeedback: {
        status: "INCORRECT",
        message: "正确答案：安静",
        continueAvailable: true,
        correction: { text: "安静" },
      },
    });
    const state = serializeRangerTrialState(record);
    assertNoAnswerKeyFields(state);
    const keys = collectKeys(state);
    for (const field of ANSWER_KEY_FIELDS) {
      expect(keys.has(field), field).toBe(false);
    }
  });

  it("P5: wrong game type is rejected", async () => {
    const rows = new Map<string, Record<string, unknown>>();
    rows.set(SESSION_ID, {
      id: SESSION_ID,
      user_id: V1_PLACEHOLDER_USER_ID,
      game_type: "SNAKE",
      plan_id: "plan-1",
      status: "active",
      state: serializeRangerTrialState(sampleRecord()),
      created_at: "2026-09-16T12:00:00.000Z",
    });
    const store = new SupabaseRangerTrialSessionStore(
      createFakeClient(rows) as never,
      V1_PLACEHOLDER_USER_ID,
    );
    await expect(store.get(SESSION_ID)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
  });

  it("P6: wrong user is rejected safely", async () => {
    const client = createFakeClient();
    const ownerStore = new SupabaseRangerTrialSessionStore(
      client as never,
      V1_PLACEHOLDER_USER_ID,
    );
    await ownerStore.save(sampleRecord());
    const otherStore = new SupabaseRangerTrialSessionStore(
      client as never,
      "00000000-0000-4000-8000-000000000099",
    );
    await expect(otherStore.get(SESSION_ID)).rejects.toBeInstanceOf(
      GameSessionError,
    );
    await expect(otherStore.get(SESSION_ID)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
  });

  it("preserves game type, ownership, and state version on save", async () => {
    const client = createFakeClient();
    const store = new SupabaseRangerTrialSessionStore(
      client as never,
      V1_PLACEHOLDER_USER_ID,
    );
    await store.save(sampleRecord());
    const row = client.rows.get(SESSION_ID);
    expect(row?.game_type).toBe("RANGER_TRIAL");
    expect(row?.user_id).toBe(V1_PLACEHOLDER_USER_ID);
    expect((row?.state as { stateVersion: string }).stateVersion).toBe("v1");
  });

  it("rejects invalid persisted state without exposing internals", () => {
    expect(() =>
      parseRangerTrialSessionRecord({
        sessionId: SESSION_ID,
        userId: V1_PLACEHOLDER_USER_ID,
        gameType: "RANGER_TRIAL",
        state: { stateVersion: "v0" },
      }),
    ).toThrow(GameSessionError);
  });
});
