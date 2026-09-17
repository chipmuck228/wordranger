import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { CuratedPlacementStore } from "./curated-placement-store";
import {
  FileCuratedPlacementStore,
  curatedPlacementFilePath,
} from "./curated-placement-store";
import { SupabaseCuratedPlacementStore } from "./supabase-curated-placement-store";
import {
  CuratedPlacementConfigError,
  resolvePlacementReviewStoreMode,
} from "./placement-review-config";
import type { PlacementBandDefinition } from "@/domain/vocabulary/provisional-placement";

export function createCuratedPlacementStore(options?: {
  definition?: PlacementBandDefinition;
  lexemeIds?: ReadonlySet<string>;
  canonicalKeys?: ReadonlySet<string>;
}): CuratedPlacementStore {
  const mode = resolvePlacementReviewStoreMode();
  if (mode === "file") {
    return new FileCuratedPlacementStore(
      curatedPlacementFilePath(),
      options?.definition,
      options?.lexemeIds,
      options?.canonicalKeys,
    );
  }

  const client = createSupabaseServiceRoleClient();
  if (!client) {
    throw new CuratedPlacementConfigError(
      "CURATED_PLACEMENT_SUPABASE_NOT_CONFIGURED",
      "PLACEMENT_REVIEW_STORE=supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The curated review store does not fall back to the anon key or the file adapter.",
    );
  }
  return new SupabaseCuratedPlacementStore(
    client,
    options?.definition,
    options?.lexemeIds,
    options?.canonicalKeys,
  );
}
