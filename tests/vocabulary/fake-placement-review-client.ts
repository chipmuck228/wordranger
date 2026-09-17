import type { SupabaseClient } from "@supabase/supabase-js";
import type { VocabularyPlacementReviewRow } from "@/server/vocabulary/curated-placement-row";

export class FakePlacementReviewsClient {
  readonly rows = new Map<string, VocabularyPlacementReviewRow>();
  readonly fromCalls: string[] = [];
  selectCalls = 0;
  upsertCalls = 0;

  seed(row: VocabularyPlacementReviewRow): void {
    this.rows.set(row.lexeme_id, { ...row });
  }

  from = (table: string) => {
    this.fromCalls.push(table);
    return {
      select: () => {
        this.selectCalls += 1;
        return {
          order: () =>
            Promise.resolve({
              data: [...this.rows.values()].sort((left, right) =>
                left.lexeme_id.localeCompare(right.lexeme_id),
              ),
              error: null,
            }),
          single: () =>
            Promise.resolve({
              data: [...this.rows.values()][0] ?? null,
              error: null,
            }),
        };
      },
      upsert: (row: VocabularyPlacementReviewRow) => {
        this.upsertCalls += 1;
        const stored: VocabularyPlacementReviewRow = {
          ...row,
          updated_at: row.updated_at ?? "2026-09-17T12:00:00.000Z",
        };
        this.rows.set(row.lexeme_id, stored);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: stored, error: null }),
          }),
        };
      },
    };
  };

  asClient(): SupabaseClient {
    return this as unknown as SupabaseClient;
  }
}
