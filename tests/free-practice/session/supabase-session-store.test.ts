import { describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { FREE_PRACTICE_ORCHESTRATION_TYPE } from "@/server/free-practice/session/constants";
import { SupabaseFreePracticeSessionStore } from "@/server/free-practice/session/supabase-store";
import type { FreePracticeSessionRecord } from "@/server/free-practice/session/types";
import { USER_A, USER_B } from "../planning/helpers";

interface RecordedQuery {
  table: string;
  action: "insert" | "select" | "update";
  filters: Array<{ column: string; value: unknown }>;
  payload?: Record<string, unknown>;
}

class FakeGameSessionClient {
  readonly rows = new Map<string, Record<string, unknown>>();
  readonly queries: RecordedQuery[] = [];

  from = (table: string) => {
    const recorded: RecordedQuery = { table, action: "select", filters: [] };
    this.queries.push(recorded);
    const rows = this.rows;
    return {
      insert: (payload: Record<string, unknown>) => {
        recorded.action = "insert";
        recorded.payload = payload;
        rows.set(String(payload.id), { ...payload });
        return Promise.resolve({ data: payload, error: null });
      },
      select: () => {
        recorded.action = "select";
        return {
          eq(column: string, value: unknown) {
            recorded.filters.push({ column, value });
            return this;
          },
          maybeSingle() {
            const id = recorded.filters.find((filter) => filter.column === "id")
              ?.value;
            const userId = recorded.filters.find(
              (filter) => filter.column === "user_id",
            )?.value;
            const gameType = recorded.filters.find(
              (filter) => filter.column === "game_type",
            )?.value;
            const row = id ? rows.get(String(id)) : undefined;
            if (
              !row ||
              row.user_id !== userId ||
              row.game_type !== gameType
            ) {
              return Promise.resolve({ data: null, error: null });
            }
            return Promise.resolve({ data: row, error: null });
          },
        };
      },
      update: (payload: Record<string, unknown>) => {
        recorded.action = "update";
        recorded.payload = payload;
        return {
          eq(column: string, value: unknown) {
            recorded.filters.push({ column, value });
            return this;
          },
          select() {
            return {
              maybeSingle() {
                const id = recorded.filters.find((filter) => filter.column === "id")
                  ?.value;
                const userId = recorded.filters.find(
                  (filter) => filter.column === "user_id",
                )?.value;
                const gameType = recorded.filters.find(
                  (filter) => filter.column === "game_type",
                )?.value;
                const revision = recorded.filters.find(
                  (filter) => filter.column === "revision",
                )?.value;
                const row = id ? rows.get(String(id)) : undefined;
                if (
                  !row ||
                  row.user_id !== userId ||
                  row.game_type !== gameType ||
                  row.revision !== revision
                ) {
                  return Promise.resolve({ data: null, error: null });
                }
                const next = {
                  ...row,
                  ...payload,
                  revision: payload.revision,
                };
                rows.set(String(id), next);
                return Promise.resolve({ data: next, error: null });
              },
            };
          },
        };
      },
    };
  };

  asClient() {
    return this as never;
  }
}

function sampleRecord(
  userId: string,
  sessionId = "session-a",
): FreePracticeSessionRecord {
  return {
    sessionId,
    userId,
    planId: `fp-plan:${sessionId}`,
    revision: 0,
    state: {
      schemaVersion: "fp-session-v2",
      source: "UNSEEN",
      requestedCount: 5,
      plannedCount: 1,
      items: [
        {
          id: "item-1",
          lexemeId: "lex-001",
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
    },
  };
}

describe("SupabaseFreePracticeSessionStore contract", () => {
  it("binds user_id and game_type on create, get, and CAS update", async () => {
    const fake = new FakeGameSessionClient();
    const store = new SupabaseFreePracticeSessionStore(fake.asClient());
    await store.create(sampleRecord(USER_A));
    const loaded = await store.get("session-a", USER_A);
    expect(loaded?.userId).toBe(USER_A);
    const foreign = await store.get("session-a", USER_B);
    expect(foreign).toBeNull();

    const getQuery = fake.queries.find((query) => query.action === "select");
    expect(getQuery?.filters).toEqual(
      expect.arrayContaining([
        { column: "id", value: "session-a" },
        { column: "user_id", value: USER_A },
        { column: "game_type", value: FREE_PRACTICE_ORCHESTRATION_TYPE },
      ]),
    );
    const insert = fake.queries.find((query) => query.action === "insert");
    expect(insert?.payload?.game_type).toBe(FREE_PRACTICE_ORCHESTRATION_TYPE);
    expect(insert?.payload?.user_id).toBe(USER_A);

    const saved = await store.save({
      ...loaded!,
      state: {
        ...loaded!.state,
        currentTaskId: "task-1",
        assignedItemId: "item-1",
      },
    });
    expect(saved.revision).toBe(1);
    const update = fake.queries.find((query) => query.action === "update");
    expect(update?.filters).toEqual(
      expect.arrayContaining([
        { column: "id", value: "session-a" },
        { column: "user_id", value: USER_A },
        { column: "game_type", value: FREE_PRACTICE_ORCHESTRATION_TYPE },
        { column: "revision", value: 0 },
      ]),
    );
    await expect(
      store.save({
        ...saved,
        revision: 0,
      }),
    ).rejects.toMatchObject({ code: "SESSION_CONFLICT" });
  });
});
