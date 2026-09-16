import type { SupabaseClient } from "@supabase/supabase-js";
import type { VocabularyDataset } from "../load-vocabulary-dataset";
import { planVocabularyImport, type ImportPlan } from "./plan-import";

const BATCH = 200;

async function upsertBatch(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (let index = 0; index < rows.length; index += BATCH) {
    const slice = rows.slice(index, index + BATCH);
    const { error } = await client.from(table).upsert(slice);
    if (error) {
      throw error;
    }
  }
}

export async function applyVocabularyImport(
  dataset: VocabularyDataset,
  client: SupabaseClient,
): Promise<ImportPlan> {
  const plan = planVocabularyImport(dataset, "apply");
  if (plan.qaIssueCount > 0) {
    throw new Error(
      `Refusing to apply import with ${plan.qaIssueCount} QA issue(s)`,
    );
  }

  await upsertBatch(
    client,
    "vocabulary_source_entries",
    dataset.sourceEntries.map((entry) => ({
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
  );

  await upsertBatch(
    client,
    "lexemes",
    dataset.lexemes.map((lexeme) => ({
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
      abbreviation_of_lexeme_id: null,
      quality_status: lexeme.quality.status,
      quality_issues: lexeme.quality.issues,
      correction_applied: lexeme.quality.correctionApplied,
      correction_note: lexeme.quality.correctionNote,
    })),
  );

  await upsertBatch(
    client,
    "lexemes",
    dataset.lexemes
      .filter((lexeme) => lexeme.abbreviationOfLexemeId)
      .map((lexeme) => ({
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
        abbreviation_of_lexeme_id: lexeme.abbreviationOfLexemeId,
        quality_status: lexeme.quality.status,
        quality_issues: lexeme.quality.issues,
        correction_applied: lexeme.quality.correctionApplied,
        correction_note: lexeme.quality.correctionNote,
      })),
  );

  await upsertBatch(
    client,
    "lexeme_relations",
    dataset.relations.map((relation) => ({
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
  );

  await upsertBatch(
    client,
    "lexeme_tags",
    dataset.tags.map((tag) => ({
      lexeme_id: tag.lexemeId,
      topics: tag.topics,
      semantic_categories: tag.semanticCategories,
      game_tags: tag.gameTags,
      topic_confidence: tag.topicConfidence,
      semantic_confidence: tag.semanticConfidence,
      game_confidence: tag.gameConfidence,
    })),
  );

  return plan;
}
