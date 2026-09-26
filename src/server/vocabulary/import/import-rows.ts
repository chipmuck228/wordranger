import type { VocabularyDataset } from "../load-vocabulary-dataset";

export interface VocabularyImportRows {
  sourceEntries: Record<string, unknown>[];
  lexemes: Record<string, unknown>[];
  lexemeAbbreviationUpdates: Record<string, unknown>[];
  relations: Record<string, unknown>[];
  tags: Record<string, unknown>[];
}

function lexemeRow(
  lexeme: VocabularyDataset["lexemes"][number],
  abbreviationOfLexemeId: string | null,
): Record<string, unknown> {
  return {
    id: lexeme.id,
    canonical_key: lexeme.canonicalKey,
    source_entry_id: lexeme.sourceEntryId,
    source_index: lexeme.sourceIndex,
    lemma: lexeme.lemma,
    display: lexeme.display,
    role: lexeme.role,
    starred: lexeme.starred,
    parts_of_speech: lexeme.partsOfSpeech,
    ipa: lexeme.ipa,
    meanings_zh: lexeme.meaningsZh,
    forms: lexeme.forms,
    variants: lexeme.variants,
    abbreviation_of_lexeme_id: abbreviationOfLexemeId,
    quality_status: lexeme.quality.status,
    quality_issues: lexeme.quality.issues,
    correction_applied: lexeme.quality.correctionApplied,
    correction_note: lexeme.quality.correctionNote,
  };
}

/** Stable row mapping shared by apply, seed fingerprint, and isolated verification. */
export function toVocabularyImportRows(
  dataset: VocabularyDataset,
): VocabularyImportRows {
  return {
    sourceEntries: dataset.sourceEntries.map((entry) => ({
      id: entry.id,
      canonical_key: entry.canonicalKey,
      source_index: entry.sourceIndex,
      section: entry.section,
      source_page_start: entry.sourcePageStart,
      source_page_end: entry.sourcePageEnd,
      source_word_raw: entry.sourceWordRaw,
      starred: entry.starred,
      source_ipa_raw: entry.sourceIpaRaw,
      source_pos_raw: entry.sourcePosRaw,
      source_meaning_raw: entry.sourceMeaningRaw,
      raw_entry: entry.rawEntry,
      parse_status: entry.parseStatus,
      parse_issues: entry.parseIssues,
      source_review_note: entry.sourceReviewNote,
    })),
    lexemes: dataset.lexemes.map((lexeme) => lexemeRow(lexeme, null)),
    lexemeAbbreviationUpdates: dataset.lexemes
      .filter((lexeme) => lexeme.abbreviationOfLexemeId)
      .map((lexeme) =>
        lexemeRow(lexeme, lexeme.abbreviationOfLexemeId ?? null),
      ),
    relations: dataset.relations.map((relation) => ({
      id: relation.id,
      canonical_key: relation.canonicalKey,
      type: relation.type,
      from_lexeme_id: relation.fromLexemeId,
      to_lexeme_id: relation.toLexemeId,
      is_symmetric: relation.symmetric,
      confidence: relation.confidence,
      provenance: relation.provenance,
      note: relation.note,
    })),
    tags: dataset.tags.map((tag) => ({
      lexeme_id: tag.lexemeId,
      topics: tag.topics,
      semantic_categories: tag.semanticCategories,
      game_tags: tag.gameTags,
      topic_confidence: tag.topicConfidence,
      semantic_confidence: tag.semanticConfidence,
      game_confidence: tag.gameConfidence,
    })),
  };
}
