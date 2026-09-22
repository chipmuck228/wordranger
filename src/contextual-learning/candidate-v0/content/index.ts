export { SceneContentErrorCode } from "./errors";
export type { SceneContentIssue, SceneContentValidation } from "./errors";
export { validateSceneContent } from "./validate-scene-content";
export { resolveSceneContent } from "./resolve-scene-content";
export { snapshotSceneContentFromPack } from "./snapshot-from-pack";
export {
  getApprovedExperimentSceneContent,
  listSceneContentRegistry,
  registryEntryFor,
  registryStatusFor,
} from "./scene-content-registry";
export { experimentalMealContextLabPack } from "./experimental-meal-runtime-pack";
export {
  fingerprintContent,
  fingerprintAuthoredPack,
  contentFingerprintPayload,
} from "./content-fingerprint";
export { selectBundledMeaningGloss } from "./select-bundled-meaning-gloss";
export {
  MEAL_LEGACY_EXPERIMENT_BASELINE,
  matchesLegacyExperimentBaseline,
} from "./packs/meal/meal-legacy-experiment-baseline";
export {
  attestationIsStructurallyBound,
  currentPackTargetFingerprint,
  promotionAttestationMatchesPack,
  validateExperimentPromotion,
} from "./validate-experiment-promotion";
export type {
  CommittedHumanReviewRecord,
  CommittedPromotionArtifacts,
  ExperimentPromotionIssue,
} from "./validate-experiment-promotion";
export {
  findResolvedLexeme,
  projectBuildProfile,
  projectProbeTargets,
  projectQueueCatalog,
  projectStrengthenIdentity,
  projectStrengthenProfile,
} from "./project-from-resolved";
export {
  presentationLeaksAnswer,
  projectPublicScenePresentation,
} from "./project-public-presentation";
export type {
  BundledMeaningGlossSelector,
  ContextualSceneContentPack,
  ResolvedContextualSceneContent,
  ResolvedContextualSceneLexeme,
  SceneContentApprovalBasis,
  SceneContentRegistryStatus,
  SceneContentReleaseEligibility,
  SceneLexemeLoader,
} from "./types";
export {
  MEAL_SCENE_CONTENT_PACK,
  MEAL_SCENE_CONTENT_PACK_ID,
  HOME_BREAKFAST_FRAME_ID,
  RESTAURANT_MEAL_FRAME_ID,
} from "./packs/meal/meal-scene-content";
export {
  MEAL_SCENE_EXPANSION_BATCH_01_PACK,
  MEAL_SCENE_EXPANSION_BATCH_01_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_TARGET,
} from "./packs/meal/meal-scene-expansion-batch-01";
export {
  MEAL_SCENE_EXPANSION_BATCH_01_CUP_PROMOTION,
  MEAL_EXPANSION_BATCH_01_CUP_APPROVED_FINGERPRINT,
  MEAL_EXPANSION_BATCH_01_CUP_APPROVED_REVISION,
  MEAL_EXPANSION_BATCH_01_CUP_REVIEW_KEY,
  MEAL_EXPANSION_BATCH_01_CUP_REVIEW_RECORD_PATH,
} from "./packs/meal/meal-scene-expansion-batch-01-promotion";
export {
  MEAL_SCENE_EXPANSION_BATCH_02_PACK,
  MEAL_SCENE_EXPANSION_BATCH_02_PACK_ID,
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_TARGET,
} from "./packs/meal/meal-scene-expansion-batch-02";
export {
  MEAL_SCENE_EXPANSION_BATCH_02_PLATE_PROMOTION,
  MEAL_EXPANSION_BATCH_02_PLATE_APPROVED_FINGERPRINT,
  MEAL_EXPANSION_BATCH_02_PLATE_APPROVED_REVISION,
  MEAL_EXPANSION_BATCH_02_PLATE_REVIEW_KEY,
  MEAL_EXPANSION_BATCH_02_PLATE_REVIEW_RECORD_PATH,
} from "./packs/meal/meal-scene-expansion-batch-02-promotion";
export type {
  CandidateV0ExperimentPromotionAttestation,
  ContextualSceneContentRegistryEntry,
} from "./types";
export {
  MEAL_EXPANSION_BATCH_01_ELIGIBILITY,
  MEAL_EXPANSION_BATCH_01_WORDS,
  eligibilityForExpansionWord,
  executableExpansionBatch01Words,
  liveExpansionEligibilitySignals,
} from "./packs/meal/meal-scene-expansion-eligibility";
export type {
  MealExpansionBatch01Word,
  MealExpansionEligibilityResult,
  MealExpansionWordEligibility,
} from "./packs/meal/meal-scene-expansion-eligibility";
