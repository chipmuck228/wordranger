import { describe, expect, it } from "vitest";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { FREE_PRACTICE_SNAPSHOT_PAGE_SIZE } from "@/server/free-practice/planning/constants";
import { planFreePractice } from "@/server/free-practice/planning/plan-free-practice";
import { SupabaseFreePracticePlanReadAdapter } from "@/server/free-practice/planning/supabase-plan-read-adapter";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { tinyDataset } from "../../tasks/helpers";
import { FakeFreePracticeSupabaseClient } from "./fake-supabase-plan-read-client";
import { makeTestLexeme, sequentialIds, USER_A, USER_B } from "./helpers";

function lexemeId(index: number): string {
  return `lex-${String(index).padStart(4, "0")}`;
}

function seedSnapshots(
  fake: FakeFreePracticeSupabaseClient,
  userId: string,
  count: number,
  masteryStage: MasteryStage = MasteryStage.EXPOSED,
): void {
  for (let index = count; index >= 1; index -= 1) {
    fake.seedSnapshot({
      user_id: userId,
      lexeme_id: lexemeId(index),
      mastery_stage: masteryStage,
    });
  }
}

describe("Supabase snapshot pagination", () => {
  it("A. returns all 1505 user A snapshots including rows 1001 and 1505", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    seedSnapshots(fake, USER_A, 1505);
    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    const rows = await adapter.listStudentLexemeSnapshots(USER_A);

    expect(rows).toHaveLength(1505);
    expect(rows[0]?.lexemeId).toBe(lexemeId(1));
    expect(rows[1000]?.lexemeId).toBe(lexemeId(1001));
    expect(rows[1504]?.lexemeId).toBe(lexemeId(1505));
    expect(fake.queries.filter((query) => query.table === "student_lexeme_models")).toHaveLength(
      2,
    );
  });

  it("B. issues an empty second page when the count is exactly 1000", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    seedSnapshots(fake, USER_A, 1000);
    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    const rows = await adapter.listStudentLexemeSnapshots(USER_A);

    expect(rows).toHaveLength(1000);
    const snapshotQueries = fake.queries.filter(
      (query) => query.table === "student_lexeme_models",
    );
    expect(snapshotQueries).toHaveLength(2);
    expect(snapshotQueries[0]?.range).toEqual({ from: 0, to: 999 });
    expect(snapshotQueries[1]?.range).toEqual({ from: 1000, to: 1999 });
  });

  it("C. keeps every page bound to user A when user B also has rows", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    seedSnapshots(fake, USER_A, 1005);
    seedSnapshots(fake, USER_B, 80);
    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    const rows = await adapter.listStudentLexemeSnapshots(USER_A);

    expect(rows).toHaveLength(1005);
    expect(rows.every((row) => row.lexemeId.startsWith("lex-"))).toBe(true);
    const snapshotQueries = fake.queries.filter(
      (query) => query.table === "student_lexeme_models",
    );
    expect(snapshotQueries.length).toBeGreaterThan(1);
    for (const query of snapshotQueries) {
      expect(query.filters).toEqual([{ column: "user_id", value: USER_A }]);
    }
    expect(rows.some((row) => row.lexemeId === lexemeId(1001))).toBe(true);
  });

  it("D. uses user_id, lexeme_id ascending, and inclusive ranges 0–999 then 1000–1999", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    seedSnapshots(fake, USER_A, 1005);
    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    await adapter.listStudentLexemeSnapshots(USER_A);

    const snapshotQueries = fake.queries.filter(
      (query) => query.table === "student_lexeme_models",
    );
    expect(snapshotQueries).toHaveLength(2);
    for (const query of snapshotQueries) {
      expect(query.filters).toEqual([{ column: "user_id", value: USER_A }]);
      expect(query.orders).toEqual([{ column: "lexeme_id", ascending: true }]);
      expect(query.select).toBe("lexeme_id, mastery_stage");
    }
    expect(snapshotQueries[0]?.range).toEqual({ from: 0, to: 999 });
    expect(snapshotQueries[1]?.range).toEqual({ from: 1000, to: 1999 });
    expect(FREE_PRACTICE_SNAPSHOT_PAGE_SIZE).toBe(1000);
  });

  it("E. rejects the whole read when the second page fails", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    seedSnapshots(fake, USER_A, 1505);
    fake.failSnapshotQueryIndex = 1;
    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());

    await expect(adapter.listStudentLexemeSnapshots(USER_A)).rejects.toMatchObject({
      message: "snapshot page failed",
    });
  });

  it("F. does not treat practiced models past row 1000 as UNSEEN", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    const practiced = 1001;
    const unseen = 5;
    seedSnapshots(fake, USER_A, practiced, MasteryStage.EXPOSED);
    const lexemes = Array.from({ length: practiced + unseen }, (_, index) =>
      makeTestLexeme({
        id: lexemeId(index + 1),
        sourceIndex: index + 1,
      }),
    );
    const result = await planFreePractice({
      userId: USER_A,
      request: { source: "UNSEEN", requestedCount: 5 },
      vocabulary: new InMemoryVocabularyRepository(tinyDataset({ lexemes })),
      read: new SupabaseFreePracticePlanReadAdapter(fake.asClient()),
      createId: sequentialIds(),
    });

    expect(result.status).toBe("READY");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items.map((item) => item.lexemeId)).toEqual([
      lexemeId(1002),
      lexemeId(1003),
      lexemeId(1004),
      lexemeId(1005),
      lexemeId(1006),
    ]);
    expect(result.items.every((item) => item.targetSkill === VocabularySkill.MEANING_RECOGNITION)).toBe(
      true,
    );
  });

  it("G. still does not insert, update, or delete", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    seedSnapshots(fake, USER_A, 1005);
    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    await adapter.listStudentLexemeSnapshots(USER_A);
    expect(fake.writes).toEqual([]);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(adapter))).not.toEqual(
      expect.arrayContaining(["insert", "update", "delete", "appendEvidence"]),
    );
  });
});
