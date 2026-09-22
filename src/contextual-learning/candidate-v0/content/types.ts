/**
 * Contextual Scene Content Contract Candidate V0.
 * Experimental / Not a Standard.
 *
 * Authored scene content only. Does not grade, create Evidence, or
 * update learner state.
 */

import type { LexemeSenseRef } from "../domain/types";

export const SCENE_CONTENT_SCHEMA_VERSION = "candidate-v0" as const;

export type ContextualFactArgument =
  | { kind: "ENTITY"; entityId: string }
  | { kind: "ROLE"; roleId: string }
  | { kind: "VALUE"; value: string };

export interface ContextualFactRef {
  factId: string;
  predicate: string;
  args: ContextualFactArgument[];
  caption?: string;
}

export type ContextualContrastKind =
  | "ROLE_CONTRAST"
  | "FUNCTION_CONTRAST"
  | "FORM_CONTRAST"
  | "MEANING_CONTRAST";

export interface ContextualContrastBinding {
  kind: ContextualContrastKind;
  contrastTarget: LexemeSenseRef;
  instruction: string;
  caption?: string;
}

export interface ContextualFrameFactGroup {
  frameId: string;
  facts: ContextualFactRef[];
}

export interface ContextualLexemeGrounding {
  frameFacts: ContextualFrameFactGroup[];
  requiredRelationIds?: string[];
}

export interface ContextualConnectFactBinding {
  frameId: string;
  factId: string;
}

export interface ContextualFrameBinding {
  frameId: string;
  entityId: string;
  roleId: string;
  sceneOrder: number;
}

export interface ContextualScenePlanningContent {
  planIdNamespace: string;
  activeGoalId: string;
  sourceLearningNeedRef: string;
  guidedRationales: {
    ground: string;
    connect: string;
    teach: string;
    contrast: string;
    fade: string;
    reconnect: string;
  };
}

export interface ContextualBuildContent {
  enabled: boolean;
  groundInstruction: string;
  connectInstruction: string;
  connectFactByFrame?: ContextualConnectFactBinding[];
  connectFactId?: string;
  teachInstruction: string;
  fadeInstruction: string;
  recallInstructionKey: string;
}

export interface ContextualStrengthenContent {
  enabled: boolean;
  reconnectInstruction: string;
  fadeInstruction: string;
  verifyInstruction: string;
}

export interface ContextualFrameContent {
  frameId: string;
  title: string;
  settingLabel: string;
  introInstruction?: string;
  entityIds: string[];
  factIds: string[];
  presentationOrder: string[];
}

export type BundledMeaningGlossSelector =
  | {
      kind: "EXACT_BUNDLED_VALUE";
      value: string;
    }
  | {
      kind: "BUNDLED_INDEX";
      index: number;
    };

export interface ContextualSceneLexemeContent {
  id: string;
  target: LexemeSenseRef;
  fixtureSense: LexemeSenseRef;
  canonicalKey: string;
  membership: {
    frameBindings: ContextualFrameBinding[];
    presentationToken: string;
    presentationRole: string;
  };
  probe: {
    skills: Array<"ACTIVE_RECALL" | "MEANING_RECOGNITION">;
    enabled: boolean;
    recallInstruction: string;
  };
  lexicalPresentation: {
    displayFormSource: "BUNDLED_VOCABULARY";
    meaningGlossSource: "BUNDLED_VOCABULARY";
    phoneticSource: "BUNDLED_VOCABULARY";
    displayLabel: string;
    meaningGlossSelector?: BundledMeaningGlossSelector;
  };
  grounding: ContextualLexemeGrounding;
  contrastBindings: ContextualContrastBinding[];
  build: ContextualBuildContent;
  strengthen: ContextualStrengthenContent;
}

export interface ContextualSceneContentPack {
  id: string;
  schemaVersion: typeof SCENE_CONTENT_SCHEMA_VERSION;
  sceneClusterId: string;
  skeletonId: string;
  frames: ContextualFrameContent[];
  lexemes: ContextualSceneLexemeContent[];
  planning: ContextualScenePlanningContent;
  provenance: {
    status: "CANDIDATE" | "APPROVED_FOR_EXPERIMENT";
    sourceRefs: string[];
    authoredAt?: string;
  };
}

export interface ResolvedContextualFact {
  factId: string;
  predicate: string;
  args: ContextualFactArgument[];
  caption?: string;
}

export interface ResolvedContextualContrast {
  kind: ContextualContrastKind;
  contrastTarget: LexemeSenseRef;
  contrastEntityId: string;
  instruction: string;
  caption?: string;
}

export interface ResolvedContextualSceneLexeme {
  id: string;
  target: LexemeSenseRef;
  fixtureSense: LexemeSenseRef;
  canonicalKey: string;
  displayForm: string;
  answerForm: string;
  inflectionNote: string | null;
  meaningGloss: string;
  phonetic?: string;
  displayLabel: string;
  frameId: string;
  entityId: string;
  roleId: string;
  sceneOrder: number;
  presentationToken: string;
  presentationRole: string;
  groundingFacts: ResolvedContextualFact[];
  requiredRelationIds: string[];
  contrasts: ResolvedContextualContrast[];
  probe: ContextualSceneLexemeContent["probe"];
  build: ContextualBuildContent;
  strengthen: ContextualStrengthenContent;
}

export interface ResolvedContextualSceneContent {
  packId: string;
  sceneClusterId: string;
  skeletonId: string;
  activeGoalId: string;
  planIdNamespace: string;
  sourceLearningNeedRef: string;
  guidedRationales: ContextualScenePlanningContent["guidedRationales"];
  frame: ContextualFrameContent;
  lexemes: ResolvedContextualSceneLexeme[];
}

export type SceneContentRegistryStatus =
  | "DRAFT"
  | "CANDIDATE"
  | "APPROVED_FOR_EXPERIMENT";

export type SceneContentReleaseEligibility = "NONE" | "RELEASE_ELIGIBLE";

export type SceneContentApprovalBasis =
  | "LEGACY_EXPERIMENT_BASELINE"
  | "HUMAN_REVIEW_PROMOTION";

export const CANDIDATE_V0_EXPERIMENT_PROMOTION_KIND =
  "CANDIDATE_V0_EXPERIMENT_PROMOTION" as const;

export type ExperimentPromotionScope = "EXPERIMENT_ONLY";

export interface CandidateV0ExperimentPromotionAttestation {
  schemaVersion: typeof SCENE_CONTENT_SCHEMA_VERSION;
  kind: typeof CANDIDATE_V0_EXPERIMENT_PROMOTION_KIND;
  packId: string;
  reviewKey: string;
  target: LexemeSenseRef;
  approvedContentFingerprint: string;
  approvedReviewRevision: number;
  approvalDecision: "APPROVED";
  reviewRecordSourcePath: string;
  promotionScope: ExperimentPromotionScope;
  promotedAt: string;
  sourceRefs: readonly string[];
}

export interface ContextualSceneContentRegistryEntry {
  packId: string;
  status: SceneContentRegistryStatus;
  pack: ContextualSceneContentPack;
  approvalBasis?: SceneContentApprovalBasis;
  promotion?: CandidateV0ExperimentPromotionAttestation;
  parentPackId?: string | null;
  releaseEligibility?: SceneContentReleaseEligibility;
}

export interface SceneLexemeLoader {
  (canonicalKey: string): {
    id: string;
    display: string;
    lemma: string;
    meaningsZh: readonly string[];
    ipa: readonly string[];
  } | null;
}
