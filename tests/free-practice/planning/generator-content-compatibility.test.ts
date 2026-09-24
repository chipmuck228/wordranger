import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { makeApprovedRelation } from "../../tasks/helpers";
import { evidence, makeTestLexeme, planWith } from "./helpers";

function incorrect(
  id: string,
  lexemeId: string,
  skill: VocabularySkill,
) {
  return evidence({
    id,
    lexemeId,
    skill,
    outcome: EvidenceOutcome.INCORRECT,
    occurredAt: "2026-09-20T12:00:00.000Z",
  });
}

describe("Free Practice generator-content compatibility", () => {
  it("rejects meaningsZh[0] blank even when a later gloss is usable", async () => {
    const lexemes = [
      makeTestLexeme({
        id: "later-gloss",
        meaningsZh: ["", "有效释义"],
        lemma: "later",
      }),
    ];

    const unseen = await planWith({
      request: { source: "UNSEEN", requestedCount: 5 },
      lexemes,
    });
    expect(unseen.result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
    });

    for (const skill of [
      VocabularySkill.MEANING_RECOGNITION,
      VocabularySkill.ACTIVE_RECALL,
      VocabularySkill.SPELLING_RECALL,
    ]) {
      const { result } = await planWith({
        request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
        lexemes,
        evidence: [incorrect(`ev-${skill}`, "later-gloss", skill)],
      });
      expect(result, skill).toMatchObject({
        status: "EMPTY",
        plannedCount: 0,
      });
    }
  });

  it("rejects ACTIVE_RECALL and SPELLING_RECALL when lemma is blank but display is not", async () => {
    const lexemes = [
      makeTestLexeme({
        id: "display-only",
        lemma: "",
        display: "Shown",
        meaningsZh: ["有效释义"],
      }),
    ];

    for (const skill of [
      VocabularySkill.ACTIVE_RECALL,
      VocabularySkill.SPELLING_RECALL,
    ]) {
      const { result } = await planWith({
        request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
        lexemes,
        evidence: [incorrect(`ev-${skill}`, "display-only", skill)],
      });
      expect(result, skill).toMatchObject({
        status: "EMPTY",
        plannedCount: 0,
      });
    }
  });

  it("keeps UNSEEN and recall skills eligible when first gloss and lemma are usable", async () => {
    const lexemes = [
      makeTestLexeme({
        id: "usable",
        lemma: "usable",
        meaningsZh: ["有效释义"],
      }),
    ];

    const unseen = await planWith({
      request: { source: "UNSEEN", requestedCount: 5 },
      lexemes,
    });
    expect(unseen.result.status).toBe("PARTIAL");
    if (unseen.result.status !== "REJECTED") {
      expect(unseen.result.items[0]).toMatchObject({
        lexemeId: "usable",
        targetSkill: VocabularySkill.MEANING_RECOGNITION,
      });
    }

    for (const skill of [
      VocabularySkill.MEANING_RECOGNITION,
      VocabularySkill.ACTIVE_RECALL,
      VocabularySkill.SPELLING_RECALL,
    ]) {
      const { result } = await planWith({
        request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
        lexemes,
        evidence: [incorrect(`ev-${skill}`, "usable", skill)],
      });
      expect(result.status, skill).toBe("PARTIAL");
      if (result.status === "REJECTED") {
        return;
      }
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.targetSkill).toBe(skill);
    }
  });

  it("rejects SEMANTIC_CONNECTION when the counterpart lexeme is missing", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "semantic" })],
      relations: [
        makeApprovedRelation({
          id: "rel-ghost",
          type: LexemeRelationType.SYNONYM,
          fromLexemeId: "semantic",
          toLexemeId: "ghost",
        }),
      ],
      evidence: [
        incorrect("ev-s", "semantic", VocabularySkill.SEMANTIC_CONNECTION),
      ],
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
    });
  });

  it("rejects SEMANTIC_CONNECTION when the counterpart lemma is blank", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [
        makeTestLexeme({ id: "semantic" }),
        makeTestLexeme({
          id: "other",
          lemma: "",
          display: "Other",
        }),
      ],
      relations: [
        makeApprovedRelation({
          id: "rel-blank",
          type: LexemeRelationType.SYNONYM,
          fromLexemeId: "semantic",
          toLexemeId: "other",
        }),
      ],
      evidence: [
        incorrect("ev-s", "semantic", VocabularySkill.SEMANTIC_CONNECTION),
      ],
    });
    expect(result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
    });
  });

  it("keeps SEMANTIC_CONNECTION when an approved relation has a usable counterpart", async () => {
    const { result } = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [
        makeTestLexeme({ id: "semantic" }),
        makeTestLexeme({ id: "other", lemma: "other" }),
      ],
      relations: [
        makeApprovedRelation({
          id: "rel-ok",
          type: LexemeRelationType.SYNONYM,
          fromLexemeId: "semantic",
          toLexemeId: "other",
        }),
      ],
      evidence: [
        incorrect("ev-s", "semantic", VocabularySkill.SEMANTIC_CONNECTION),
      ],
    });
    expect(result.status).toBe("PARTIAL");
    if (result.status === "REJECTED") {
      return;
    }
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.targetSkill).toBe(
      VocabularySkill.SEMANTIC_CONNECTION,
    );
  });

  it("does not fall back to another skill when the requested skill lacks content", async () => {
    const missingCounterpart = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [makeTestLexeme({ id: "semantic", meaningsZh: ["有效释义"] })],
      relations: [
        makeApprovedRelation({
          id: "rel-ghost",
          type: LexemeRelationType.SYNONYM,
          fromLexemeId: "semantic",
          toLexemeId: "ghost",
        }),
      ],
      evidence: [
        incorrect("ev-s", "semantic", VocabularySkill.SEMANTIC_CONNECTION),
      ],
    });
    expect(missingCounterpart.result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
      items: [],
    });

    const displayOnlyRecall = await planWith({
      request: { source: "RECENTLY_INCORRECT", requestedCount: 5 },
      lexemes: [
        makeTestLexeme({
          id: "display-only",
          lemma: "",
          display: "Shown",
          meaningsZh: ["有效释义"],
        }),
      ],
      evidence: [
        incorrect("ev-a", "display-only", VocabularySkill.ACTIVE_RECALL),
      ],
    });
    expect(displayOnlyRecall.result).toMatchObject({
      status: "EMPTY",
      plannedCount: 0,
      items: [],
    });
  });
});
