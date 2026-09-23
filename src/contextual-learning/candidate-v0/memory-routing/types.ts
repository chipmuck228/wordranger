/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Planning intents only. Not learner-state, Evidence, or mastery.
 */

import type { LearningNeed, LearningNeedReason } from "@/domain/learning/learning-need";
import type { WeaknessType } from "@/domain/learning/weakness.types";
import type { CognitiveMode, LexemeSenseRef } from "../domain/types";

export type ContextualMemoryIntent = Extract<CognitiveMode, "BUILD" | "STRENGTHEN">;

export type FrozenLearningNeedSignal = Pick<
  LearningNeed,
  "lexemeId" | "reason" | "supportingReasons" | "weaknessFocus"
>;

export interface ContextualMemoryRoutingInput {
  target: LexemeSenseRef;
  learningNeed: FrozenLearningNeedSignal;
}

export type ContextualMemoryRoutingReason =
  | "FROZEN_REVIEW_DUE"
  | "FROZEN_WEAKNESS_ACTIVE_RECALL"
  | "FROZEN_WEAKNESS_SPELLING"
  | "FROZEN_WEAKNESS_CONFUSION"
  | "FROZEN_WEAKNESS_HINT_DEPENDENCY"
  | "FROZEN_WEAKNESS_OTHER"
  | "AUTHORED_CANDIDATE_BUILD_FIXTURE";

export type ContextualMemoryRoutingGap =
  | "MEMORY_ROUTING_INSUFFICIENT_FROZEN_SIGNAL"
  | "MEMORY_ROUTING_CONFLICTING_SIGNALS"
  | "MEMORY_ROUTING_UNKNOWN_NEED_REASON"
  | "MEMORY_ROUTING_UNMAPPED_SENSE";

export interface RoutingProvenance {
  source: "FROZEN_LEARNING_NEED";
  needReason?: LearningNeedReason;
  supportingReasons: readonly LearningNeedReason[];
  weaknessType?: WeaknessType;
  ruleId: string;
}

export type ContextualMemoryRoutingDecision =
  | {
      status: "RESOLVED";
      intent: ContextualMemoryIntent;
      target: LexemeSenseRef;
      reason: ContextualMemoryRoutingReason;
      provenance: RoutingProvenance;
    }
  | {
      status: "UNRESOLVED";
      target: LexemeSenseRef;
      reason: ContextualMemoryRoutingGap;
      provenance: RoutingProvenance;
    };

export type SceneMemberLearningPriority = "PRIMARY" | "SUPPORTING" | "CONTRAST";

export type SceneMemberPerspectiveId = "REQUESTER" | "OWNER";

export interface SceneVocabularyMember {
  target: LexemeSenseRef;
  lexemeCanonicalKey: string;
  roleId: string;
  roleDescription: string;
  learningPriority?: SceneMemberLearningPriority;
  perspectiveId?: SceneMemberPerspectiveId;
  candidateFixtureLexemeId?: string;
}

export interface SceneVocabularyCluster {
  id: string;
  version: string;
  title: string;
  semanticScope: string;
  allowedRoleIds: readonly string[];
  members: readonly SceneVocabularyMember[];
}

export type SceneVocabularyCoverageIssueCode =
  | "SCENE_MEMBER_UNKNOWN_LEXEME"
  | "SCENE_MEMBER_CANONICAL_KEY_MISMATCH"
  | "SCENE_MEMBER_AMBIGUOUS_SENSE"
  | "SCENE_MEMBER_DUPLICATE_IDENTITY"
  | "SCENE_MEMBER_MISSING_SENSE"
  | "SCENE_MEMBER_ILLEGAL_ROLE"
  | "SCENE_CATALOG_UNSUPPORTED_VERSION"
  | "SCENE_CATALOG_UNSUPPORTED_SCHEMA";

export interface SceneVocabularyCoverageIssue {
  code: SceneVocabularyCoverageIssueCode;
  clusterId?: string;
  lexemeId?: string;
  senseId?: string;
  canonicalKey?: string;
  message: string;
}

export interface VocabularyLexemeIdentity {
  id: string;
  canonicalKey: string;
  lemma: string;
  meaningsZh: readonly string[];
}

export interface SceneVocabularyCoverageReport {
  vocabularyVersion: string;
  totalLexemes: number;
  assignedLexemes: number;
  unassignedLexemes: number;
  ambiguousSenseLexemes: number;
  invalidAssignments: SceneVocabularyCoverageIssue[];
  clusterCounts: Record<string, number>;
}

export const SCENE_VOCABULARY_CATALOG_VERSION = "candidate-v0.1";
export const BUNDLED_VOCABULARY_PROVENANCE = "candidate-v0-bundled-canonical";
