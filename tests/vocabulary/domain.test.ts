import { describe, expect, it } from "vitest";
import { EvidenceOutcome } from "@/domain/learning/evidence.types";
import { processEvidence } from "@/domain/learning/engine/process-evidence";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { assertRelationInvariants } from "@/domain/vocabulary/validate-relation";
import { InMemoryLearningRepository } from "@/server/learning/in-memory-learning-repository";
import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { InMemoryVocabularyInspectionRepository } from "@/server/vocabulary/in-memory-vocabulary-inspection-repository";
import { planVocabularyImport } from "@/server/vocabulary/import/plan-import";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import { validateVocabularyDataset } from "@/server/vocabulary/qa";
import { makeEvidence } from "../learning/helpers";

const dataset = loadVocabularyDataset();
const repository = new InMemoryVocabularyRepository(dataset);

describe("Vocabulary Domain", () => {
  it("TEST V1: 1600 source entries all exist", () => {
    expect(dataset.sourceEntries).toHaveLength(1600);
    expect(dataset.meta.sourceEntryCount).toBe(1600);
    const indexes = new Set(dataset.sourceEntries.map((entry) => entry.sourceIndex));
    expect(indexes.size).toBe(1600);
    for (let index = 1; index <= 1600; index += 1) {
      expect(indexes.has(index)).toBe(true);
    }
  });

  it("TEST V2: canonical lexeme count matches the data file meta", () => {
    expect(dataset.lexemes).toHaveLength(dataset.meta.lexemeCount);
  });

  it("TEST V3: every lexeme traces to a source entry", () => {
    const sourceIds = new Set(dataset.sourceEntries.map((entry) => entry.id));
    for (const lexeme of dataset.lexemes) {
      expect(sourceIds.has(lexeme.sourceEntryId)).toBe(true);
    }
  });

  it("TEST V4: actor / actress is two lexemes", () => {
    const pair = dataset.lexemes.filter((lexeme) => lexeme.sourceIndex === 19);
    expect(pair.map((lexeme) => lexeme.lemma).sort()).toEqual([
      "actor",
      "actress",
    ]);
    const source = dataset.sourceEntries.find((entry) => entry.sourceIndex === 19);
    expect(source?.sourceWordRaw).toBe("actor / actress");
  });

  it("TEST V5: the two lexemes can have independent StudentLexemeModel rows", async () => {
    const actor = dataset.lexemes.find((lexeme) => lexeme.canonicalKey === "lex-0019-1");
    const actress = dataset.lexemes.find(
      (lexeme) => lexeme.canonicalKey === "lex-0019-2",
    );
    expect(actor && actress).toBeTruthy();
    const learning = new InMemoryLearningRepository();
    const actorResult = await processEvidence({
      evidence: makeEvidence("actor-e1", "s1", "2026-03-01T09:00:00.000Z", {
        lexemeId: actor!.id,
        outcome: EvidenceOutcome.INDEPENDENT_CORRECT,
      }),
      repository: learning,
    });
    const actressResult = await processEvidence({
      evidence: makeEvidence("actress-e1", "s1", "2026-03-01T09:00:00.000Z", {
        lexemeId: actress!.id,
        outcome: EvidenceOutcome.INCORRECT,
      }),
      repository: learning,
    });
    expect(actorResult.model.lexemeId).toBe(actor!.id);
    expect(actressResult.model.lexemeId).toBe(actress!.id);
    expect(actorResult.model.id).not.toBe(actressResult.model.id);
    expect(actorResult.model.lastSuccessAt).not.toBeNull();
    expect(actressResult.model.lastFailureAt).not.toBeNull();
    expect(actorResult.model.lastFailureAt).toBeNull();
    expect(actressResult.model.lastSuccessAt).toBeNull();
    expect(actorResult.model.evidenceCount).toBe(1);
    expect(actressResult.model.evidenceCount).toBe(1);
  });

  it("TEST V6: relation endpoints must exist", () => {
    const lexemeIds = new Set(dataset.lexemes.map((lexeme) => lexeme.id));
    for (const relation of dataset.relations) {
      expect(lexemeIds.has(relation.fromLexemeId)).toBe(true);
      expect(lexemeIds.has(relation.toLexemeId)).toBe(true);
    }
  });

  it("TEST V7: self relations are rejected", () => {
    const lexeme = dataset.lexemes[0];
    expect(() =>
      assertRelationInvariants({
        canonicalKey: "rel-self",
        fromLexemeId: lexeme.id,
        toLexemeId: lexeme.id,
        confidence: 1,
      }),
    ).toThrow(/Self relation/);
  });

  it("TEST V8: confidence outside 0..1 is rejected", () => {
    const [from, to] = dataset.lexemes;
    expect(() =>
      assertRelationInvariants({
        canonicalKey: "rel-bad-confidence",
        fromLexemeId: from.id,
        toLexemeId: to.id,
        confidence: 1.4,
      }),
    ).toThrow(/0\.\.1/);
  });

  it("TEST V9: production queries exclude rule_inferred relations", async () => {
    const inferred = dataset.relations.find(
      (relation) => relation.provenance === "rule_inferred",
    );
    expect(inferred).toBeTruthy();
    const returned = await repository.getRelations(inferred!.fromLexemeId);
    expect(
      returned.some((relation) => relation.provenance === "rule_inferred"),
    ).toBe(false);
    const inspected = await new InMemoryVocabularyInspectionRepository(
      repository,
    ).getRawRelations(inferred!.fromLexemeId);
    expect(inspected.some((relation) => relation.id === inferred!.id)).toBe(
      true,
    );
    const bypass = await repository.getRelations(inferred!.fromLexemeId, {
      provenances: ["rule_inferred"],
    });
    expect(bypass).toEqual([]);
  });

  it("TEST V10: curated_model must meet the confidence policy", async () => {
    const below = dataset.relations.find(
      (relation) =>
        relation.provenance === "curated_model" && relation.confidence < 0.8,
    );
    const above = dataset.relations.find(
      (relation) =>
        relation.provenance === "curated_model" && relation.confidence >= 0.8,
    );
    expect(above).toBeTruthy();
    if (below) {
      const returned = await repository.getRelations(below.fromLexemeId);
      expect(returned.some((relation) => relation.id === below.id)).toBe(false);
    }
    const allowed = await repository.getRelations(above!.fromLexemeId);
    expect(allowed.some((relation) => relation.id === above!.id)).toBe(true);
  });

  it("TEST V11: quiet has a production confusable relation to quite", async () => {
    const [quiet] = await repository.findLexemeByLemma("quiet");
    const [quite] = await repository.findLexemeByLemma("quite");
    expect(quiet && quite).toBeTruthy();
    const relations = await repository.getRelations(quiet.id, {
      types: [LexemeRelationType.CONFUSABLE],
    });
    expect(
      relations.some(
        (relation) =>
          relation.toLexemeId === quite.id || relation.fromLexemeId === quite.id,
      ),
    ).toBe(true);
  });

  it("TEST V12: source facts are not rewritten by canonical correction", () => {
    const source = dataset.sourceEntries.find((entry) => entry.sourceIndex === 535);
    const lexeme = dataset.lexemes.find(
      (item) => item.canonicalKey === "lex-0535-1",
    );
    expect(source?.sourceMeaningRaw).toBe("青蛙");
    expect(lexeme?.meaningsZh).toEqual(["雾"]);
    expect(lexeme?.quality.correctionApplied).toBe(true);
  });

  it("reports import QA against the loaded dataset", () => {
    const qa = validateVocabularyDataset(dataset);
    const plan = planVocabularyImport(dataset, "dry-run");
    expect(qa.sourceEntryCount).toBe(dataset.sourceEntries.length);
    expect(plan.mode).toBe("dry-run");
    expect(plan.lexemes).toBe(dataset.lexemes.length);
    expect(plan.rejectedRelations).toBeGreaterThan(0);
  });
});
