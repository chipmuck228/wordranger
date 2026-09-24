import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { MasteryStage } from "@/domain/learning/mastery-stage";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { InMemoryFreePracticePlanReadAdapter } from "@/server/free-practice/planning/in-memory-plan-read-adapter";
import {
  assertPlanPayload,
  makeTestLexeme,
  planWith,
  sequentialIds,
  snapshot,
  USER_A,
} from "./helpers";

describe("Free Practice UNSEEN plan", () => {
  it("1. 100 eligible, request 10 → READY 10", async () => {
    const lexemes = Array.from({ length: 100 }, (_, index) =>
      makeTestLexeme({
        id: `lex-${String(index + 1).padStart(3, "0")}`,
        sourceIndex: index + 1,
        canonicalKey: `key-${String(index + 1).padStart(3, "0")}`,
      }),
    );
    const { result } = await planWith({
      request: { source: "UNSEEN", requestedCount: 10 },
      lexemes,
    });
    expect(result.status).toBe("READY");
    if (result.status !== "READY") {
      return;
    }
    expect(result.plannedCount).toBe(10);
    expect(result.items).toHaveLength(10);
    expect(result.items.map((item) => item.lexemeId)).toEqual(
      lexemes.slice(0, 10).map((lexeme) => lexeme.id),
    );
    expect(
      result.items.every(
        (item) => item.targetSkill === VocabularySkill.MEANING_RECOGNITION,
      ),
    ).toBe(true);
    assertPlanPayload(result);
  });

  it("2. 3 eligible, request 10 → PARTIAL 3", async () => {
    const { result } = await planWith({
      request: { source: "UNSEEN", requestedCount: 10 },
      lexemes: [
        makeTestLexeme({ id: "a" }),
        makeTestLexeme({ id: "b" }),
        makeTestLexeme({ id: "c" }),
      ],
    });
    expect(result).toMatchObject({
      status: "PARTIAL",
      plannedCount: 3,
      reason: "INSUFFICIENT_ELIGIBLE_WORDS",
    });
    if (result.status !== "PARTIAL") {
      return;
    }
    expect(result.items).toHaveLength(3);
    assertPlanPayload(result);
  });

  it("3. 0 eligible → EMPTY and does not persist", async () => {
    const read = new InMemoryFreePracticePlanReadAdapter();
    const { result } = await planWith({
      request: { source: "UNSEEN", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "blank", meaningsZh: ["  "] })],
      snapshots: [snapshot("blank", MasteryStage.EXPOSED)],
      read,
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
      items: [],
      reason: "NO_ELIGIBLE_WORDS",
    });
    expect(read.writeAttempts).toBe(0);
    expect(await read.listStudentLexemeSnapshots(USER_A)).toHaveLength(1);
    assertPlanPayload(result);
  });

  it("4. excludes lexemes with a non-UNSEEN model", async () => {
    const { result } = await planWith({
      request: { source: "UNSEEN", requestedCount: 10 },
      lexemes: [
        makeTestLexeme({ id: "unseen-model" }),
        makeTestLexeme({ id: "exposed" }),
        makeTestLexeme({ id: "no-model" }),
      ],
      snapshots: [
        snapshot("unseen-model", MasteryStage.UNSEEN),
        snapshot("exposed", MasteryStage.EXPOSED),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items.map((item) => item.lexemeId)).toEqual([
      "unseen-model",
      "no-model",
    ]);
  });

  it("5. excludes lexemes without usable meaningsZh", async () => {
    const { result } = await planWith({
      request: { source: "UNSEEN", requestedCount: 5 },
      lexemes: [
        makeTestLexeme({ id: "empty", meaningsZh: [] }),
        makeTestLexeme({ id: "blank", meaningsZh: ["   "] }),
        makeTestLexeme({ id: "ok", meaningsZh: ["可以"] }),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items.map((item) => item.lexemeId)).toEqual(["ok"]);
  });

  it("6. sorts by sourceIndex then canonicalKey", async () => {
    const { result } = await planWith({
      request: { source: "UNSEEN", requestedCount: 5 },
      lexemes: [
        makeTestLexeme({
          id: "z",
          sourceIndex: 2,
          canonicalKey: "z-key",
        }),
        makeTestLexeme({
          id: "b",
          sourceIndex: 1,
          canonicalKey: "b-key",
        }),
        makeTestLexeme({
          id: "a",
          sourceIndex: 1,
          canonicalKey: "a-key",
        }),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items.map((item) => item.lexemeId)).toEqual(["a", "b", "z"]);
  });

  it("7. requestedCount outside 5/10 fails closed", async () => {
    for (const requestedCount of [0, 3, 8, 11, 40]) {
      const { result } = await planWith({
        request: {
          source: "UNSEEN",
          requestedCount: requestedCount as 5,
        },
        lexemes: [makeTestLexeme({ id: "a" })],
      });
      expect(result).toEqual({
        status: "REJECTED",
        reason: "INVALID_REQUESTED_COUNT",
      });
    }
  });

  it("does not fill UNSEEN from RECENTLY_INCORRECT evidence", async () => {
    const { result } = await planWith({
      request: { source: "UNSEEN", requestedCount: 5 },
      lexemes: [
        makeTestLexeme({ id: "seen", meaningsZh: ["看过"] }),
        makeTestLexeme({ id: "wrong", meaningsZh: ["错"] }),
      ],
      snapshots: [
        snapshot("seen", MasteryStage.RECOGNIZED),
        snapshot("wrong", MasteryStage.EXPOSED),
      ],
      evidence: [
        {
          id: "ev-1",
          lexemeId: "wrong",
          skill: VocabularySkill.MEANING_RECOGNITION,
          outcome: EvidenceOutcome.INCORRECT,
          occurredAt: "2026-09-20T12:00:00.000Z",
        },
      ],
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
      reason: "NO_ELIGIBLE_WORDS",
    });
  });

  it("ignores a userId field smuggled on the request object", async () => {
    const { result } = await planWith({
      userId: USER_A,
      request: {
        source: "UNSEEN",
        requestedCount: 5,
        userId: USER_A,
      } as never,
      lexemes: [makeTestLexeme({ id: "a" })],
      createId: sequentialIds(),
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items[0]?.lexemeId).toBe("a");
    expect(JSON.stringify(result)).not.toContain("userId");
  });

  it("rejects a blank server userId", async () => {
    const { result } = await planWith({
      userId: "   ",
      request: { source: "UNSEEN", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "a" })],
    });
    expect(result).toEqual({
      status: "REJECTED",
      reason: "INVALID_USER",
    });
  });
});
