import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVocabularyImportRows } from "@/server/vocabulary/import/import-rows";
import {
  VOCABULARY_CONTENT_FINGERPRINT_VERSION,
  assertVocabularySeedMatches,
  buildVocabularySeedManifest,
  fingerprintVocabularyImportRows,
} from "@/server/vocabulary/import/rebuild-contract";
import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import type { VocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

function cloneDataset(dataset: VocabularyDataset): VocabularyDataset {
  return structuredClone(dataset);
}

function fingerprintOf(dataset: VocabularyDataset): string {
  return buildVocabularySeedManifest(dataset).fingerprint;
}

describe("vocabulary empty-target seed contract", () => {
  it("A: repeated loads of the same dataset share one content fingerprint", () => {
    const first = buildVocabularySeedManifest(loadVocabularyDataset());
    const second = buildVocabularySeedManifest(loadVocabularyDataset());
    expect(first.algorithmVersion).toBe(VOCABULARY_CONTENT_FINGERPRINT_VERSION);
    expect(first).toEqual(second);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    assertVocabularySeedMatches(first, second);
    const rows = toVocabularyImportRows(loadVocabularyDataset());
    expect(fingerprintVocabularyImportRows(rows).fingerprint).toBe(
      first.fingerprint,
    );
    expect(rows.sourceEntries).toHaveLength(first.sourceEntries);
    expect(JSON.stringify(rows)).not.toContain("learning_evidence");
    expect(JSON.stringify(rows)).not.toContain("student_lexeme_models");
    expect(JSON.stringify(rows)).not.toContain("game_sessions");
  });

  it("B: changing only lemma changes the fingerprint", () => {
    const dataset = cloneDataset(loadVocabularyDataset());
    const baseline = fingerprintOf(dataset);
    dataset.lexemes[0]!.lemma = `${dataset.lexemes[0]!.lemma}-changed`;
    expect(fingerprintOf(dataset)).not.toBe(baseline);
  });

  it("C: changing only meaningsZh changes the fingerprint", () => {
    const dataset = cloneDataset(loadVocabularyDataset());
    const baseline = fingerprintOf(dataset);
    dataset.lexemes[0]!.meaningsZh = [...dataset.lexemes[0]!.meaningsZh, "额外义项"];
    expect(fingerprintOf(dataset)).not.toBe(baseline);
  });

  it("D: changing only IPA or forms changes the fingerprint", () => {
    const dataset = cloneDataset(loadVocabularyDataset());
    const baseline = fingerprintOf(dataset);
    dataset.lexemes[0]!.ipa = [...dataset.lexemes[0]!.ipa, "ipa-changed"];
    expect(fingerprintOf(dataset)).not.toBe(baseline);
    const forms = cloneDataset(loadVocabularyDataset());
    forms.lexemes[0]!.forms = [...forms.lexemes[0]!.forms, "form-changed"];
    expect(fingerprintOf(forms)).not.toBe(baseline);
  });

  it("E: changing only relation type, confidence, or note changes the fingerprint", () => {
    const baseline = fingerprintOf(loadVocabularyDataset());
    const typeChanged = cloneDataset(loadVocabularyDataset());
    typeChanged.relations[0]!.type =
      typeChanged.relations[0]!.type === LexemeRelationType.SYNONYM
        ? LexemeRelationType.ANTONYM
        : LexemeRelationType.SYNONYM;
    expect(fingerprintOf(typeChanged)).not.toBe(baseline);
    const confidenceChanged = cloneDataset(loadVocabularyDataset());
    confidenceChanged.relations[0]!.confidence = 0.123;
    expect(fingerprintOf(confidenceChanged)).not.toBe(baseline);
    const noteChanged = cloneDataset(loadVocabularyDataset());
    noteChanged.relations[0]!.note = "note-changed";
    expect(fingerprintOf(noteChanged)).not.toBe(baseline);
  });

  it("F: changing only tag topics, categories, or confidence changes the fingerprint", () => {
    const baseline = fingerprintOf(loadVocabularyDataset());
    const topics = cloneDataset(loadVocabularyDataset());
    topics.tags[0]!.topics = [...topics.tags[0]!.topics, "topic-changed"];
    expect(fingerprintOf(topics)).not.toBe(baseline);
    const categories = cloneDataset(loadVocabularyDataset());
    categories.tags[0]!.semanticCategories = [
      ...categories.tags[0]!.semanticCategories,
      "category-changed",
    ];
    expect(fingerprintOf(categories)).not.toBe(baseline);
    const confidence = cloneDataset(loadVocabularyDataset());
    confidence.tags[0]!.topicConfidence = 0.42;
    expect(fingerprintOf(confidence)).not.toBe(baseline);
  });

  it("G: reordering top-level rows does not change the fingerprint", () => {
    const dataset = cloneDataset(loadVocabularyDataset());
    const baseline = fingerprintOf(dataset);
    dataset.sourceEntries.reverse();
    dataset.lexemes.reverse();
    dataset.relations.reverse();
    dataset.tags.reverse();
    expect(fingerprintOf(dataset)).toBe(baseline);
  });

  it("H: changing abbreviationOfLexemeId changes the fingerprint", () => {
    const dataset = cloneDataset(loadVocabularyDataset());
    const baseline = fingerprintOf(dataset);
    const first = dataset.lexemes[0]!;
    const other = dataset.lexemes.find((lexeme) => lexeme.id !== first.id);
    expect(other).toBeTruthy();
    first.abbreviationOfLexemeId = other!.id;
    expect(fingerprintOf(dataset)).not.toBe(baseline);
  });

  it("keeps fingerprint mode offline in the existing importer", () => {
    const script = readFileSync(
      path.join(process.cwd(), "scripts/import-vocabulary.ts"),
      "utf8",
    );
    expect(script).toContain("--fingerprint");
    expect(script).toContain("buildVocabularySeedManifest");
    expect(script).toMatch(
      /if \(mode === "fingerprint"\)[\s\S]*return;[\s\S]*createSupabaseServerClient/,
    );
  });
});
