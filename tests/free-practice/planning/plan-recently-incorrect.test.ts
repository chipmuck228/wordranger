import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT } from "@/server/free-practice/planning/constants";
import { makeApprovedRelation } from "../../tasks/helpers";
import {
  assertPlanPayload,
  evidence,
  makeTestLexeme,
  planWith,
} from "./helpers";

const THREE_WORDS = [
  makeTestLexeme({ id: "apple" }),
  makeTestLexeme({ id: "bread" }),
  makeTestLexeme({ id: "chair" }),
];

function incorrectAt(
  id: string,
  lexemeId: string,
  occurredAt: string,
  skill: VocabularySkill = VocabularySkill.MEANING_RECOGNITION,
) {
  return evidence({
    id,
    lexemeId,
    skill,
    outcome: EvidenceOutcome.INCORRECT,
    occurredAt,
  });
}

describe("Free Practice RECENTLY_INCORRECT plan", () => {
  it("A. meaning INCORRECT then meaning correct → not eligible", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "apple" })],
      evidence: [
        incorrectAt("ev-1", "apple", "2026-09-20T10:00:00.000Z"),
        evidence({
          id: "ev-2",
          lexemeId: "apple",
          skill: VocabularySkill.MEANING_RECOGNITION,
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          occurredAt: "2026-09-20T11:00:00.000Z",
        }),
      ],
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
      reason: "NO_ELIGIBLE_WORDS",
    });
    assertPlanPayload(result);
  });

  it("B. meaning INCORRECT then spelling correct → meaning still eligible", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "apple" })],
      evidence: [
        incorrectAt("ev-1", "apple", "2026-09-20T10:00:00.000Z"),
        evidence({
          id: "ev-2",
          lexemeId: "apple",
          skill: VocabularySkill.SPELLING_RECALL,
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          occurredAt: "2026-09-20T11:00:00.000Z",
        }),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      lexemeId: "apple",
      targetSkill: VocabularySkill.MEANING_RECOGNITION,
      source: "RECENTLY_INCORRECT",
    });
    assertPlanPayload(result);
  });

  it("C. two unresolved skills on one lexeme → one item, newer skill", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "apple" })],
      evidence: [
        incorrectAt(
          "ev-meaning",
          "apple",
          "2026-09-20T10:00:00.000Z",
          VocabularySkill.MEANING_RECOGNITION,
        ),
        incorrectAt(
          "ev-spelling",
          "apple",
          "2026-09-20T11:00:00.000Z",
          VocabularySkill.SPELLING_RECALL,
        ),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.targetSkill).toBe(VocabularySkill.SPELLING_RECALL);
    expect(result.items[0]?.lexemeId).toBe("apple");
  });

  it("D. three unresolved incorrect lexemes, request 10 → PARTIAL 3", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 10 },
      lexemes: THREE_WORDS,
      evidence: [
        incorrectAt("ev-a", "apple", "2026-09-20T12:00:00.000Z"),
        incorrectAt("ev-b", "bread", "2026-09-20T11:00:00.000Z"),
        incorrectAt("ev-c", "chair", "2026-09-20T10:00:00.000Z"),
      ],
    });
    expect(result).toMatchObject({
      status: "PARTIAL",
      plannedCount: 3,
      reason: "INSUFFICIENT_ELIGIBLE_WORDS",
    });
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items.map((item) => item.lexemeId)).toEqual([
      "apple",
      "bread",
      "chair",
    ]);
    assertPlanPayload(result);
  });

  it("E. those three later answered correctly on the same skill → EMPTY", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 10 },
      lexemes: THREE_WORDS,
      evidence: [
        incorrectAt("ev-a", "apple", "2026-09-20T10:00:00.000Z"),
        incorrectAt("ev-b", "bread", "2026-09-20T10:01:00.000Z"),
        incorrectAt("ev-c", "chair", "2026-09-20T10:02:00.000Z"),
        evidence({
          id: "ev-a2",
          lexemeId: "apple",
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          occurredAt: "2026-09-20T11:00:00.000Z",
        }),
        evidence({
          id: "ev-b2",
          lexemeId: "bread",
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          occurredAt: "2026-09-20T11:01:00.000Z",
        }),
        evidence({
          id: "ev-c2",
          lexemeId: "chair",
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          occurredAt: "2026-09-20T11:02:00.000Z",
        }),
      ],
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
      reason: "NO_ELIGIBLE_WORDS",
    });
  });

  it("F. INCORRECT older than the 40-row terminal window is not eligible", async () => {
    const recentCorrect: ReturnType<typeof evidence>[] = Array.from(
      { length: FREE_PRACTICE_RECENT_TERMINAL_EVIDENCE_LIMIT },
      (_, index) =>
        evidence({
          id: `recent-${String(index).padStart(2, "0")}`,
          lexemeId: "apple",
          outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
          occurredAt: new Date(
            Date.UTC(2026, 8, 21, 12, index, 0),
          ).toISOString(),
        }),
    );
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 10 },
      lexemes: [makeTestLexeme({ id: "apple" }), makeTestLexeme({ id: "old" })],
      evidence: [
        incorrectAt("ev-old", "old", "2026-08-01T00:00:00.000Z"),
        ...recentCorrect,
      ],
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
      reason: "NO_ELIGIBLE_WORDS",
    });
  });

  it("assisted correct clears the same skill key without claiming mastery", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "apple" })],
      evidence: [
        incorrectAt("ev-1", "apple", "2026-09-20T10:00:00.000Z"),
        evidence({
          id: "ev-2",
          lexemeId: "apple",
          outcome: EvidenceOutcome.ASSISTED_CORRECT,
          occurredAt: "2026-09-20T11:00:00.000Z",
        }),
      ],
    });
    expect(result.status).toBe("EMPTY");
    if (result.status === "REJECTED") {
      return;
    }
    expect(JSON.stringify(result)).not.toMatch(/MASTERED|masteryStage/);
  });

  it("uses evidence id as tie-break when occurredAt is identical", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "apple" })],
      evidence: [
        incorrectAt(
          "ev-aaa",
          "apple",
          "2026-09-20T12:00:00.000Z",
          VocabularySkill.MEANING_RECOGNITION,
        ),
        incorrectAt(
          "ev-zzz",
          "apple",
          "2026-09-20T12:00:00.000Z",
          VocabularySkill.SPELLING_RECALL,
        ),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.targetSkill).toBe(VocabularySkill.SPELLING_RECALL);
  });

  it("drops lexemes missing from current vocabulary", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "apple" })],
      evidence: [
        incorrectAt("ev-1", "ghost", "2026-09-20T12:00:00.000Z"),
        incorrectAt("ev-2", "apple", "2026-09-20T11:00:00.000Z"),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items.map((item) => item.lexemeId)).toEqual(["apple"]);
  });

  it("excludes unsupported or missing-content skills without fallback", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [
        makeTestLexeme({ id: "listen" }),
        makeTestLexeme({ id: "context" }),
        makeTestLexeme({ id: "semantic" }),
        makeTestLexeme({ id: "blank", meaningsZh: [] }),
      ],
      evidence: [
        incorrectAt(
          "ev-l",
          "listen",
          "2026-09-20T12:00:00.000Z",
          VocabularySkill.LISTENING_RECOGNITION,
        ),
        incorrectAt(
          "ev-c",
          "context",
          "2026-09-20T11:00:00.000Z",
          VocabularySkill.CONTEXT_USE,
        ),
        incorrectAt(
          "ev-s",
          "semantic",
          "2026-09-20T10:00:00.000Z",
          VocabularySkill.SEMANTIC_CONNECTION,
        ),
        incorrectAt(
          "ev-b",
          "blank",
          "2026-09-20T09:00:00.000Z",
          VocabularySkill.MEANING_RECOGNITION,
        ),
      ],
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
    });
  });

  it("keeps SEMANTIC_CONNECTION only when an approved relation exists", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [
        makeTestLexeme({ id: "semantic" }),
        makeTestLexeme({ id: "other" }),
      ],
      relations: [
        makeApprovedRelation({
          id: "rel-1",
          type: LexemeRelationType.SYNONYM,
          fromLexemeId: "semantic",
          toLexemeId: "other",
        }),
      ],
      evidence: [
        incorrectAt(
          "ev-s",
          "semantic",
          "2026-09-20T10:00:00.000Z",
          VocabularySkill.SEMANTIC_CONNECTION,
        ),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items[0]?.targetSkill).toBe(
      VocabularySkill.SEMANTIC_CONNECTION,
    );
  });

  it("SKIPPED and TIMEOUT do not create or keep eligibility", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "apple" }), makeTestLexeme({ id: "bread" })],
      evidence: [
        incorrectAt("ev-1", "apple", "2026-09-20T10:00:00.000Z"),
        evidence({
          id: "ev-2",
          lexemeId: "apple",
          outcome: EvidenceOutcome.SKIPPED,
          occurredAt: "2026-09-20T11:00:00.000Z",
        }),
        evidence({
          id: "ev-3",
          lexemeId: "bread",
          outcome: EvidenceOutcome.TIMEOUT,
          occurredAt: "2026-09-20T12:00:00.000Z",
        }),
      ],
    });
    expect(result.status).toBe("EMPTY");
  });

  it("does not fill RECENTLY_INCORRECT from UNSEEN vocabulary", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 10 },
      lexemes: Array.from({ length: 20 }, (_, index) =>
        makeTestLexeme({ id: `fresh-${index}` }),
      ),
      evidence: [],
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
      reason: "NO_ELIGIBLE_WORDS",
    });
  });

  it("final order is selected occurredAt desc then lexemeId asc", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 10 },
      lexemes: [
        makeTestLexeme({ id: "zeta" }),
        makeTestLexeme({ id: "alpha" }),
        makeTestLexeme({ id: "mu" }),
      ],
      evidence: [
        incorrectAt("ev-z", "zeta", "2026-09-20T12:00:00.000Z"),
        incorrectAt("ev-a", "alpha", "2026-09-20T12:00:00.000Z"),
        incorrectAt("ev-m", "mu", "2026-09-20T11:00:00.000Z"),
      ],
    });
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items.map((item) => item.lexemeId)).toEqual([
      "alpha",
      "zeta",
      "mu",
    ]);
  });
});
