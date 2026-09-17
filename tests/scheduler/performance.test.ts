import { describe, expect, it } from "vitest";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { SeededRandomSource } from "@/domain/tasks/random-source";
import { InMemoryLearningStateQueryRepository } from "@/server/scheduler/in-memory-learning-state-query-repository";
import { planLearningSession } from "@/server/scheduler/plan-learning-session";
import {
  buildVocabularyLearningContentCapability,
  lexemeLearningCapabilityFromContent,
} from "@/server/scheduler/vocabulary-learning-content-capability";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import {
  makeApprovedRelation,
  tinyDataset,
} from "../tasks/helpers";
import { sequentialIdFactory } from "../learning/helpers";
import { CountingVocabularyRepository } from "./counting-vocabulary-repository";

function lexeme(id: string, meaningsZh: string[], lemma = id) {
  return {
    id,
    lemma,
    display: lemma,
    meaningsZh,
  };
}

function manyLexemes(count: number) {
  return Array.from({ length: count }, (_, index) =>
    lexeme(`lex-${index}`, [`义${index}`], `word${index}`),
  );
}

async function planWithCountedVocabulary(
  inner: InMemoryVocabularyRepository,
) {
  const vocabulary = new CountingVocabularyRepository(inner);
  await planLearningSession({
    userId: "perf-user",
    now: "2026-09-16T12:00:00.000Z",
    requestedNeedCount: 8,
    createId: sequentialIdFactory("perf"),
    random: new SeededRandomSource("perf"),
    vocabulary,
    query: new InMemoryLearningStateQueryRepository(),
  });
  return vocabulary.calls;
}

describe("Scheduler planning query shape", () => {
  it("PERF1: 10 lexemes issue one listRelations and no getRelations", async () => {
    const inner = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: manyLexemes(10),
        relations: [
          makeApprovedRelation({
            id: "rel-0",
            type: LexemeRelationType.SYNONYM,
            fromLexemeId: "lex-0",
            toLexemeId: "lex-1",
          }),
        ],
      }),
    );
    const calls = await planWithCountedVocabulary(inner);
    expect(calls.listLexemes).toBe(1);
    expect(calls.listRelations).toBe(1);
    expect(calls.getRelations).toBe(0);
    expect(calls.listPlacementMetadata).toBe(0);
  });

  it("PERF2: 1000 lexemes still issue one listRelations and no getRelations", async () => {
    const inner = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: manyLexemes(1000),
        relations: [
          makeApprovedRelation({
            id: "rel-0",
            type: LexemeRelationType.SYNONYM,
            fromLexemeId: "lex-0",
            toLexemeId: "lex-1",
          }),
        ],
      }),
    );
    const calls = await planWithCountedVocabulary(inner);
    expect(calls.listLexemes).toBe(1);
    expect(calls.listRelations).toBe(1);
    expect(calls.getRelations).toBe(0);
    expect(calls.listPlacementMetadata).toBe(0);
  });
});

describe("Bulk listRelations production policy", () => {
  const vocabulary = new InMemoryVocabularyRepository(
    tinyDataset({
      lexemes: [
        lexeme("a", ["A"]),
        lexeme("b", ["B"]),
        lexeme("c", ["C"]),
        lexeme("d", ["D"]),
      ],
      relations: [
        makeApprovedRelation({
          id: "rel-structural",
          type: LexemeRelationType.SYNONYM,
          fromLexemeId: "a",
          toLexemeId: "b",
        }),
        {
          ...makeApprovedRelation({
            id: "rel-curated",
            type: LexemeRelationType.ANTONYM,
            fromLexemeId: "a",
            toLexemeId: "c",
          }),
          provenance: "curated_model",
          confidence: 0.85,
        },
        {
          ...makeApprovedRelation({
            id: "rel-inferred",
            type: LexemeRelationType.CONFUSABLE,
            fromLexemeId: "a",
            toLexemeId: "d",
          }),
          provenance: "rule_inferred",
          confidence: 1,
        },
        {
          ...makeApprovedRelation({
            id: "rel-curated-low",
            type: LexemeRelationType.WORD_FAMILY,
            fromLexemeId: "b",
            toLexemeId: "c",
          }),
          provenance: "curated_model",
          confidence: 0.5,
        },
      ],
    }),
  );

  it("PERF3: listRelations does not return rule_inferred under production policy", async () => {
    const relations = await vocabulary.listRelations();
    expect(
      relations.some((relation) => relation.provenance === "rule_inferred"),
    ).toBe(false);
    expect(relations.map((relation) => relation.id).sort()).toEqual([
      "rel-curated",
      "rel-structural",
    ]);
  });

  it("PERF4: provenances: [rule_inferred] cannot bypass production policy", async () => {
    const bypass = await vocabulary.listRelations({
      provenances: ["rule_inferred"],
    });
    expect(bypass).toEqual([]);
  });

  it("PERF5: types/minConfidence/provenances only narrow production-approved results", async () => {
    const all = await vocabulary.listRelations();
    const byType = await vocabulary.listRelations({
      types: [LexemeRelationType.ANTONYM],
    });
    const byProvenance = await vocabulary.listRelations({
      provenances: ["curated_model"],
    });
    const byConfidence = await vocabulary.listRelations({
      minConfidence: 0.9,
    });
    expect(byType.map((relation) => relation.id)).toEqual(["rel-curated"]);
    expect(byProvenance.map((relation) => relation.id)).toEqual(["rel-curated"]);
    expect(byConfidence.map((relation) => relation.id)).toEqual([
      "rel-structural",
    ]);
    const approvedIds = new Set(all.map((relation) => relation.id));
    for (const subset of [byType, byProvenance, byConfidence]) {
      expect(subset.every((relation) => approvedIds.has(relation.id))).toBe(
        true,
      );
    }
  });
});

describe("Bulk-built capability equivalence", () => {
  it("matches per-lexeme getRelations capability for representative lexemes", async () => {
    const vocabulary = new InMemoryVocabularyRepository(
      tinyDataset({
        lexemes: [
          lexeme("meaning-only", ["安静"]),
          lexeme("with-approved", ["有关系"]),
          lexeme("approved-peer", ["同伴"]),
          lexeme("inferred-only", ["推断"]),
          lexeme("inferred-peer", ["推断同伴"]),
          lexeme("no-meaning", []),
          lexeme("directed-from", ["起点"]),
          lexeme("directed-to", ["终点"]),
        ],
        relations: [
          makeApprovedRelation({
            id: "rel-approved",
            type: LexemeRelationType.SYNONYM,
            fromLexemeId: "with-approved",
            toLexemeId: "approved-peer",
          }),
          {
            ...makeApprovedRelation({
              id: "rel-inferred",
              type: LexemeRelationType.ANTONYM,
              fromLexemeId: "inferred-only",
              toLexemeId: "inferred-peer",
            }),
            provenance: "rule_inferred",
            confidence: 1,
          },
          {
            ...makeApprovedRelation({
              id: "rel-directed",
              type: LexemeRelationType.ABBREVIATION,
              fromLexemeId: "directed-from",
              toLexemeId: "directed-to",
            }),
            symmetric: false,
          },
        ],
      }),
    );
    const lexemes = await vocabulary.listLexemes();
    const relations = await vocabulary.listRelations();
    const bulk = buildVocabularyLearningContentCapability(lexemes, relations);

    expect(
      bulk.supports("meaning-only", VocabularySkill.MEANING_RECOGNITION),
    ).toBe(true);
    expect(
      bulk.supports("meaning-only", VocabularySkill.SEMANTIC_CONNECTION),
    ).toBe(false);
    expect(
      bulk.supports("with-approved", VocabularySkill.SEMANTIC_CONNECTION),
    ).toBe(true);
    expect(
      bulk.supports("approved-peer", VocabularySkill.SEMANTIC_CONNECTION),
    ).toBe(true);
    expect(
      bulk.supports("inferred-only", VocabularySkill.SEMANTIC_CONNECTION),
    ).toBe(false);
    expect(
      bulk.supports("no-meaning", VocabularySkill.MEANING_RECOGNITION),
    ).toBe(false);
    expect(
      bulk.supports("directed-from", VocabularySkill.SEMANTIC_CONNECTION),
    ).toBe(true);
    expect(
      bulk.supports("directed-to", VocabularySkill.SEMANTIC_CONNECTION),
    ).toBe(false);

    for (const item of lexemes) {
      const expected = lexemeLearningCapabilityFromContent(
        item,
        await vocabulary.getRelations(item.id),
      );
      expect(bulk.getCapability(item.id)).toEqual(expected);
    }
  });
});
