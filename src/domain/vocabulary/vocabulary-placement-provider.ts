import type { PlacementBandDefinition } from "./provisional-placement";
import type { ProvisionalLexemePlacement } from "./provisional-placement";
import type { ProvisionalPlacementQaReport } from "./provisional-placement";

/**
 * Replaceable Vocabulary Domain port for provisional review buckets.
 * Future curated overlays can implement the same shape without touching
 * Evidence, StudentLexemeModel, TaskEvaluator, or renderers.
 *
 * Production Adaptive Placement must not read this port.
 */
export interface VocabularyPlacementProvider {
  getBandDefinition(): Promise<PlacementBandDefinition>;
  listProvisionalPlacements(): Promise<ProvisionalLexemePlacement[]>;
  summarizeProvisionalPlacement(): Promise<ProvisionalPlacementQaReport>;
}
