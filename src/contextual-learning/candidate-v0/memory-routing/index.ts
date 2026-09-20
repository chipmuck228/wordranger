/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Not part of the stable WordRanger public API.
 */

export { auditSceneVocabularyCoverage } from "./audit-scene-vocabulary-coverage";
export { BUNDLED_LEXEME_BINDINGS, BUNDLED_SPOON_LEXEME_ID } from "./bundled-lexeme-bindings";
export { planningModeFromRoutingDecision } from "./planning-mode";
export { routeContextualMemory } from "./route-contextual-memory";
export {
  BORROWING_SHARING_SCENE_CLUSTER,
  MEAL_SCENE_CLUSTER,
  MEAL_UTENSIL_CONTRAST_CLUSTER,
  SCENE_VOCABULARY_CLUSTERS,
  SCHOOL_CHALLENGE_SCENE_CLUSTER,
} from "./scene-catalog";
export { validateSceneVocabularyCatalog } from "./validate-scene-catalog";
export {
  BUNDLED_VOCABULARY_PROVENANCE,
  SCENE_VOCABULARY_CATALOG_VERSION,
} from "./types";
export type {
  ContextualMemoryIntent,
  ContextualMemoryRoutingDecision,
  ContextualMemoryRoutingGap,
  ContextualMemoryRoutingInput,
  ContextualMemoryRoutingReason,
  FrozenLearningNeedSignal,
  RoutingProvenance,
  SceneVocabularyCluster,
  SceneVocabularyCoverageIssue,
  SceneVocabularyCoverageReport,
  SceneVocabularyMember,
  VocabularyLexemeIdentity,
} from "./types";
