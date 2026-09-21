/**
 * Candidate V0 experiment promotion for human-reviewed plate.
 * APPROVED_FOR_EXPERIMENT only. Not Standard. Not production /train.
 */

import { deepFreeze } from "../../immutable";
import type { CandidateV0ExperimentPromotionAttestation } from "../../types";
import { CANDIDATE_V0_EXPERIMENT_PROMOTION_KIND } from "../../types";
import { MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET } from "./meal-scene-expansion-batch-02";
import { MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID } from "./meal-scene-expansion-batch-02";

export const MEAL_EXPANSION_BATCH_02_PLATE_REVIEW_KEY =
  "meal-expansion-batch-02-plate";

export const MEAL_EXPANSION_BATCH_02_PLATE_APPROVED_FINGERPRINT =
  "4ce843238a0b5b4ca570b335e75ed2549b9af94acf536144812ecc1c86ed032b";

export const MEAL_EXPANSION_BATCH_02_PLATE_APPROVED_REVISION = 1;

export const MEAL_EXPANSION_BATCH_02_PLATE_REVIEW_RECORD_PATH =
  "docs/contextual-content-reviews/meal-expansion-batch-02-plate/human-review.record.json";

export const MEAL_SCENE_EXPANSION_BATCH_02_PLATE_PROMOTION: CandidateV0ExperimentPromotionAttestation =
  deepFreeze({
    schemaVersion: "candidate-v0",
    kind: CANDIDATE_V0_EXPERIMENT_PROMOTION_KIND,
    packId: MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
    reviewKey: MEAL_EXPANSION_BATCH_02_PLATE_REVIEW_KEY,
    target: {
      lexemeId: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET.lexemeId,
      senseId: MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET.senseId,
    },
    approvedContentFingerprint: MEAL_EXPANSION_BATCH_02_PLATE_APPROVED_FINGERPRINT,
    approvedReviewRevision: MEAL_EXPANSION_BATCH_02_PLATE_APPROVED_REVISION,
    approvalDecision: "APPROVED",
    reviewRecordSourcePath: MEAL_EXPANSION_BATCH_02_PLATE_REVIEW_RECORD_PATH,
    promotionScope: "EXPERIMENT_ONLY",
    promotedAt: "2026-09-21",
    sourceRefs: [
      "docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_02_CANDIDATE.md",
      MEAL_EXPANSION_BATCH_02_PLATE_REVIEW_RECORD_PATH,
      "docs/contextual-content-reviews/meal-expansion-batch-02-plate/HUMAN_REVIEW.md",
    ],
  });
