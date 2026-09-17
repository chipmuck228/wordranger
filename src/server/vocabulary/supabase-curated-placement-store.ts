import type { SupabaseClient } from "@supabase/supabase-js";
import { cloneCuratedOverride } from "@/domain/vocabulary/curated-placement";
import type { CuratedPlacementOverride } from "@/domain/vocabulary/curated-placement";
import { curatedPlacementIssues } from "@/domain/vocabulary/validate-curated-placement";
import type { PlacementBandDefinition } from "@/domain/vocabulary/provisional-placement";
import type { CuratedPlacementStore } from "./curated-placement-store";
import { CuratedPlacementWriteError } from "./curated-placement-store";
import {
  VOCABULARY_PLACEMENT_REVIEW_COLUMNS,
  VOCABULARY_PLACEMENT_REVIEWS_TABLE,
  mapVocabularyPlacementReviewRow,
  toVocabularyPlacementReviewRow,
  type VocabularyPlacementReviewRow,
} from "./curated-placement-row";

export class SupabaseCuratedPlacementStore implements CuratedPlacementStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly definition?: PlacementBandDefinition,
    private readonly lexemeIds?: ReadonlySet<string>,
    private readonly canonicalKeys?: ReadonlySet<string>,
  ) {}

  async list(): Promise<CuratedPlacementOverride[]> {
    const { data, error } = await this.client
      .from(VOCABULARY_PLACEMENT_REVIEWS_TABLE)
      .select(VOCABULARY_PLACEMENT_REVIEW_COLUMNS)
      .order("lexeme_id", { ascending: true });
    if (error) {
      throw new CuratedPlacementWriteError(
        `Cannot list curated placement reviews: ${error.message}`,
        error,
      );
    }
    const rows = Array.isArray(data) ? data : [];
    const records = rows.map((row) =>
      mapVocabularyPlacementReviewRow(row as VocabularyPlacementReviewRow),
    );
    this.assertValid(records);
    return records.map(cloneCuratedOverride);
  }

  async upsert(
    record: CuratedPlacementOverride,
  ): Promise<CuratedPlacementOverride> {
    const row = toVocabularyPlacementReviewRow(record);
    const { data, error } = await this.client
      .from(VOCABULARY_PLACEMENT_REVIEWS_TABLE)
      .upsert(row, { onConflict: "lexeme_id" })
      .select(VOCABULARY_PLACEMENT_REVIEW_COLUMNS)
      .single();
    if (error || !data) {
      throw new CuratedPlacementWriteError(
        `Cannot upsert curated placement for ${record.lexemeId}: ${error?.message ?? "empty response"}`,
        error,
      );
    }
    const saved = mapVocabularyPlacementReviewRow(
      data as VocabularyPlacementReviewRow,
    );
    this.assertValid([saved]);
    return cloneCuratedOverride(saved);
  }

  private assertValid(records: readonly CuratedPlacementOverride[]): void {
    if (!this.definition || !this.lexemeIds) {
      return;
    }
    const issues = curatedPlacementIssues({
      definition: this.definition,
      records,
      lexemeIds: this.lexemeIds,
      canonicalKeys: this.canonicalKeys,
    });
    if (issues.length > 0) {
      throw new Error(
        `Persisted curated placement is invalid:\n${issues
          .map((issue) => `${issue.code}: ${issue.message}`)
          .join("\n")}`,
      );
    }
  }
}
