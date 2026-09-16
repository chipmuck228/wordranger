import { describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { buildVocabularyLearningContentCapability } from "@/server/scheduler/vocabulary-learning-content-capability";
import {
  makeApprovedRelation,
  tinyDataset,
} from "../tasks/helpers";

function lexeme(id: string, meaningsZh: string[], lemma = id) {
  return {
    id,
    lemma,
    display: lemma,
    meaningsZh,
  };
}

describe("Lexeme-aware vocabulary capability", () => {
  it("CH1: meaning present → MEANING_RECOGNITION true", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({ lexemes: [lexeme("a", ["安静"])] }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(capability.supports("a", VocabularySkill.MEANING_RECOGNITION)).toBe(true);
  });

  it("CH2: blank/no meaning → MEANING_RECOGNITION false", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: [lexeme("blank", ["  "]), lexeme("empty", [])],
      }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(capability.supports("blank", VocabularySkill.MEANING_RECOGNITION)).toBe(
      false,
    );
    expect(capability.supports("empty", VocabularySkill.MEANING_RECOGNITION)).toBe(
      false,
    );
  });

  it("CH3: meaning + lemma → ACTIVE_RECALL true", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({ lexemes: [lexeme("quiet", ["安静"])] }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(capability.supports("quiet", VocabularySkill.ACTIVE_RECALL)).toBe(true);
  });

  it("CH4: meaning + lemma → SPELLING_RECALL true", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({ lexemes: [lexeme("quiet", ["安静"])] }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(capability.supports("quiet", VocabularySkill.SPELLING_RECALL)).toBe(true);
  });

  it("CH5: approved relation exists → SEMANTIC_CONNECTION true", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: [lexeme("a", ["A"]), lexeme("b", ["B"])],
        relations: [
          makeApprovedRelation({
            id: "rel-1",
            type: LexemeRelationType.SYNONYM,
            fromLexemeId: "a",
            toLexemeId: "b",
          }),
        ],
      }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(capability.supports("a", VocabularySkill.SEMANTIC_CONNECTION)).toBe(true);
  });

  it("CH6: no approved relation → SEMANTIC_CONNECTION false", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({ lexemes: [lexeme("solo", ["单独"])] }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(capability.supports("solo", VocabularySkill.SEMANTIC_CONNECTION)).toBe(
      false,
    );
    expect(
      capability.getCapability("solo")?.reasons[VocabularySkill.SEMANTIC_CONNECTION],
    ).toEqual([
      "No production-approved relation available for SEMANTIC_CONNECTION",
    ]);
  });

  it("CH7: rule_inferred-only relation → SEMANTIC_CONNECTION false", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: [lexeme("a", ["A"]), lexeme("b", ["B"])],
        relations: [
          {
            ...makeApprovedRelation({
              id: "rel-inferred",
              type: LexemeRelationType.SYNONYM,
              fromLexemeId: "a",
              toLexemeId: "b",
            }),
            provenance: "rule_inferred",
            confidence: 1,
          },
        ],
      }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(capability.supports("a", VocabularySkill.SEMANTIC_CONNECTION)).toBe(
      false,
    );
  });

  it("CH8: LISTENING false", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({ lexemes: [lexeme("a", ["A"])] }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(
      capability.supports("a", VocabularySkill.LISTENING_RECOGNITION),
    ).toBe(false);
  });

  it("CH9: CONTEXT false", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({ lexemes: [lexeme("a", ["A"])] }),
    );
    const capability = await buildVocabularyLearningContentCapability(vocabulary);
    expect(capability.supports("a", VocabularySkill.CONTEXT_USE)).toBe(false);
  });
});
