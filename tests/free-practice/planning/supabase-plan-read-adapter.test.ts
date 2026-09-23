import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT } from "@/server/free-practice/planning/constants";
import { SupabaseFreePracticePlanReadAdapter } from "@/server/free-practice/planning/supabase-plan-read-adapter";
import { FakeFreePracticeSupabaseClient } from "./fake-supabase-plan-read-client";
import { USER_A, USER_B } from "./helpers";

describe("SupabaseFreePracticePlanReadAdapter contract", () => {
  it("queries the last 40 terminal evidence rows for one user, all outcomes", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    fake.seedEvidence({
      user_id: USER_A,
      id: "ev-old",
      lexeme_id: "old",
      skill: VocabularySkill.MEANING_RECOGNITION,
      outcome: EvidenceOutcome.INCORRECT,
      occurred_at: "2026-08-01T00:00:00.000Z",
    });
    for (let index = 0; index < 42; index += 1) {
      fake.seedEvidence({
        user_id: USER_A,
        id: `ev-${String(index).padStart(2, "0")}`,
        lexeme_id: "apple",
        skill: VocabularySkill.MEANING_RECOGNITION,
        outcome:
          index % 2 === 0
            ? EvidenceOutcome.INCORRECT
            : EvidenceOutcome.INDEPENDENT_CORRECT,
        occurred_at: new Date(Date.UTC(2026, 8, 21, 12, index, 0)).toISOString(),
      });
    }
    fake.seedEvidence({
      user_id: USER_B,
      id: "ev-b",
      lexeme_id: "apple",
      skill: VocabularySkill.MEANING_RECOGNITION,
      outcome: EvidenceOutcome.INCORRECT,
      occurred_at: "2026-09-22T00:00:00.000Z",
    });

    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    const rows = await adapter.listRecentTerminalEvidence(
      USER_A,
      FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT,
    );

    const query = fake.queries.at(-1);
    expect(query).toMatchObject({
      table: "learning_evidence",
      select: "id, lexeme_id, skill, outcome, occurred_at",
      limit: 40,
    });
    expect(query?.filters).toEqual([{ column: "user_id", value: USER_A }]);
    expect(query?.orders).toEqual([
      { column: "occurred_at", ascending: false },
      { column: "id", ascending: false },
    ]);
    expect(query?.filters.some((filter) => filter.column === "outcome")).toBe(
      false,
    );
    expect(rows).toHaveLength(40);
    expect(rows.some((row) => row.outcome === EvidenceOutcome.INCORRECT)).toBe(
      true,
    );
    expect(
      rows.some((row) => row.outcome === EvidenceOutcome.INDEPENDENT_CORRECT),
    ).toBe(true);
    expect(rows.some((row) => row.id === "ev-old")).toBe(false);
    expect(rows.some((row) => row.id === "ev-b")).toBe(false);
    expect(fake.writes).toEqual([]);
  });

  it("reads only the bound user's student lexeme snapshots", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    fake.seedSnapshot({
      user_id: USER_A,
      lexeme_id: "apple",
      mastery_stage: MasteryStage.EXPOSED,
    });
    fake.seedSnapshot({
      user_id: USER_B,
      lexeme_id: "bread",
      mastery_stage: MasteryStage.UNSEEN,
    });

    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    const rows = await adapter.listStudentLexemeSnapshots(USER_A);
    const query = fake.queries.at(-1);

    expect(query).toMatchObject({
      table: "student_lexeme_models",
      select: "lexeme_id, mastery_stage",
    });
    expect(query?.filters).toEqual([{ column: "user_id", value: USER_A }]);
    expect(rows).toEqual([
      { lexemeId: "apple", masteryStage: MasteryStage.EXPOSED },
    ]);
    expect(fake.writes).toEqual([]);
  });

  it("refuses to query without a trusted userId", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    await expect(adapter.listRecentTerminalEvidence("  ", 40)).rejects.toThrow(
      /trusted userId/,
    );
    await expect(adapter.listStudentLexemeSnapshots("")).rejects.toThrow(
      /trusted userId/,
    );
    expect(fake.queries).toHaveLength(0);
  });

  it("does not issue insert/update/delete", async () => {
    const fake = new FakeFreePracticeSupabaseClient();
    const adapter = new SupabaseFreePracticePlanReadAdapter(fake.asClient());
    await adapter.listRecentTerminalEvidence(USER_A, 40);
    await adapter.listStudentLexemeSnapshots(USER_A);
    expect(fake.writes).toEqual([]);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(adapter))).not.toEqual(
      expect.arrayContaining(["insert", "update", "delete", "appendEvidence"]),
    );
  });
});
