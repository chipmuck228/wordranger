import type { SupabaseClient } from "@supabase/supabase-js";
import type { VocabularyDataset } from "../load-vocabulary-dataset";
import {
  VOCABULARY_IMPORT_BATCH_SIZE,
  VocabularyImportBatchError,
  type VocabularyImportOperation,
  type VocabularyImportTable,
} from "./batch-error";
import { toVocabularyImportRows } from "./import-rows";
import { planVocabularyImport, type ImportPlan } from "./plan-import";

async function upsertBatch(
  client: SupabaseClient,
  table: VocabularyImportTable,
  operation: VocabularyImportOperation,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (
    let batchStart = 0;
    batchStart < rows.length;
    batchStart += VOCABULARY_IMPORT_BATCH_SIZE
  ) {
    const slice = rows.slice(
      batchStart,
      batchStart + VOCABULARY_IMPORT_BATCH_SIZE,
    );
    try {
      const { error, status } = await client.from(table).upsert(slice);
      if (error) {
        throw new VocabularyImportBatchError({
          table,
          operation,
          batchStart,
          batchSize: slice.length,
          cause: error,
          httpStatus: status,
        });
      }
    } catch (error) {
      if (error instanceof VocabularyImportBatchError) {
        throw error;
      }
      throw new VocabularyImportBatchError({
        table,
        operation,
        batchStart,
        batchSize: slice.length,
        cause: error,
      });
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

  const rows = toVocabularyImportRows(dataset);

  await upsertBatch(
    client,
    "vocabulary_source_entries",
    "SOURCE_ENTRIES_UPSERT",
    rows.sourceEntries,
  );
  await upsertBatch(client, "lexemes", "LEXEMES_UPSERT", rows.lexemes);
  await upsertBatch(
    client,
    "lexemes",
    "LEXEME_ABBREVIATIONS_UPDATE",
    rows.lexemeAbbreviationUpdates,
  );
  await upsertBatch(
    client,
    "lexeme_relations",
    "RELATIONS_UPSERT",
    rows.relations,
  );
  await upsertBatch(client, "lexeme_tags", "TAGS_UPSERT", rows.tags);

  return plan;
}
