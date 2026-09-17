import type { CuratedPlacementOverride } from "./curated-placement";
import type { EffectivePlacement } from "./curated-placement";
import type { PlacementReviewCoverage } from "./curated-placement";
import type { PlacementBandDefinition } from "./provisional-placement";
import type { ProvisionalLexemePlacement } from "./provisional-placement";
import type { ProvisionalPlacementQaReport } from "./provisional-placement";

/**
 * Replaceable Vocabulary Domain port for review buckets and curated overlays.
 * Production Adaptive Placement / Scheduler / Daily Training must not read this.
 */
export interface VocabularyPlacementProvider {
  getBandDefinition(): Promise<PlacementBandDefinition>;
  listProvisionalPlacements(): Promise<ProvisionalLexemePlacement[]>;
  listCuratedOverrides(): Promise<CuratedPlacementOverride[]>;
  listEffectivePlacements(): Promise<EffectivePlacement[]>;
  summarizeProvisionalPlacement(): Promise<ProvisionalPlacementQaReport>;
  summarizePlacementReview(): Promise<PlacementReviewCoverage>;
}
