import type { SupabaseClient } from "@supabase/supabase-js";
import type { VocabularyDataset } from "../load-vocabulary-dataset";
import { planVocabularyImport, type ImportPlan } from "./plan-import";
import { toVocabularyImportRows } from "./import-rows";

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

  const rows = toVocabularyImportRows(dataset);

  await upsertBatch(client, "vocabulary_source_entries", rows.sourceEntries);
  await upsertBatch(client, "lexemes", rows.lexemes);
  await upsertBatch(client, "lexemes", rows.lexemeAbbreviationUpdates);
  await upsertBatch(client, "lexeme_relations", rows.relations);
  await upsertBatch(client, "lexeme_tags", rows.tags);

  return plan;
}
