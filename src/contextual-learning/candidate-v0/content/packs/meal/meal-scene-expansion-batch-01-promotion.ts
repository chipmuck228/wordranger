/**
 * Candidate V0 experiment promotion for human-reviewed cup.
 * APPROVED_FOR_EXPERIMENT only. Not Standard. Not production /train.
 */

import { deepFreeze } from "../../immutable";
import type { CandidateV0ExperimentPromotionAttestation } from "../../types";
import { CANDIDATE_V0_EXPERIMENT_PROMOTION_KIND } from "../../types";
import { MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET } from "./meal-scene-expansion-batch-01";
import { MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID } from "./meal-scene-expansion-batch-01";

export const MEAL_EXPANSION_BATCH_01_CUP_REVIEW_KEY = "meal-expansion-batch-01-cup";

export const MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT =
  "51dc51dc1a321f2af03126d75db1823e59eed61f7e3168c47f4b360611997a40";

export const MEAL_EXPANSION_BATCH_01_CUP_APPROVED_REVISION = 1;

export const MEAL_EXPANSION_BATCH_01_CUP_REVIEW_RECORD_PATH =
  "docs/contextual-content-reviews/meal-expansion-batch-01-cup/human-review.record.json";

export const MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION: CandidateV0ExperimentPromotionAttestation =
  deepFreeze({
    schemaVersion: "candidate-v0",
    kind: CANDIDATE_V0_EXPERIMENT_PROMOTION_KIND,
    packId: MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
    reviewKey: MEAL_EXPANSION_BATCH_01_CUP_REVIEW_KEY,
    target: {
      lexemeId: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET.lexemeId,
      senseId: MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET.senseId,
    },
    approvedContentFingerprint: MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT,
    approvedReviewRevision: MEAL_EXPANSION_BATCH_01_CUP_APPROVED_REVISION,
    approvalDecision: "APPROVED",
    reviewRecordSourcePath: MEAL_EXPANSION_BATCH_01_CUP_REVIEW_RECORD_PATH,
    promotionScope: "EXPERIMENT_ONLY",
    promotedAt: "2026-09-21",
    sourceRefs: [
      "docs/CONTEXTUAL_MEAL_EXPANSION_BATCH_01_CANDIDATE.md",
      MEAL_EXPANSION_BATCH_01_CUP_REVIEW_RECORD_PATH,
      "docs/contextual-content-reviews/meal-expansion-batch-01-cup/HUMAN_REVIEW.md",
    ],
  });
