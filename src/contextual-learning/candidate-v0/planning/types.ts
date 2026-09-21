/**
 * Candidate V0 / Experimental / Not a Standard.
 * Planner contracts. Mode is supplied; learner state is not read.
 */

import type { SceneLexemeLoader } from "../content/types";
import type { ContextualMemoryRoutingDecision } from "../memory-routing/types";
import type {
  CognitiveMode,
  ContextFrameId,
  ExperienceTarget,
  LearningExperiencePlan,
  LexemeSenseRef,
  RuntimeCapability,
  SemanticSkeletonId,
} from "../domain/types";
import type { ExperiencePlanningError } from "./errors";

/**
 * Candidate planner input. Intentionally omits learnerStateRef: this
 * increment does not inspect learner snapshots. Domain
 * ExperiencePlanningInput still documents that future field.
 */
export interface ExperiencePlanningInput {
  learningNeedRef: string;
  mode: CognitiveMode;
  targets: ExperienceTarget[];
  allowedContextIds?: ContextFrameId[];
  runtimeCapabilities: RuntimeCapability[];
  /**
   * Optional precomputed Candidate routing decision.
   * Planner never derives BUILD/STRENGTHEN from a learner snapshot.
   * UNRESOLVED fails closed. Omitted keeps the existing happy path.
   */
  memoryRoutingDecision?: ContextualMemoryRoutingDecision;
  /**
   * Injected bundled-vocabulary loader. Candidate never imports server
   * runtime. Meal Home/Restaurant resolve requires this.
   */
  loadLexeme?: SceneLexemeLoader;
}

export interface PlanVariantRequest {
  targets?: readonly ExperienceTarget[];
  loadLexeme?: SceneLexemeLoader;
}

export type PlanExecutability =
  | "FULLY_EXECUTABLE"
  | "PARTIALLY_EXECUTABLE"
  | "GUIDED_ONLY"
  | "UNSUPPORTED";

export interface RejectedTargetRequirement {
  variantId: string;
  requestedTargetId: string;
  lexemeId: string;
  senseId: string;
  field: "sense" | "focus" | "requiredRoleIds" | "requiredRelationIds";
  requested: string | string[];
  available: string | string[];
  path: string;
}

export interface ExperiencePlanningTrace {
  requestedMode: CognitiveMode;
  requestedTargetIdentities: Array<{ lexemeId: string; senseId: string }>;
  consideredContextIds: ContextFrameId[];
  consideredVariantIds: string[];
  rejectedVariantReasons: Array<{ variantId: string; reason: string }>;
  rejectedTargetRequirements: RejectedTargetRequirement[];
  selectedVariantId?: string;
  requiredCapabilityIds: string[];
  availableCapabilityIds: string[];
  executability?: PlanExecutability;
}

export type ExperiencePlanningResult =
  | {
      ok: true;
      plan: LearningExperiencePlan;
      trace: ExperiencePlanningTrace;
    }
  | {
      ok: false;
      error: ExperiencePlanningError;
      trace: ExperiencePlanningTrace;
    };

export interface ExperiencePlanVariant {
  id: string;
  priority: number;
  mode: CognitiveMode;
  supportedSenses: readonly LexemeSenseRef[];
  requiredSenses: readonly LexemeSenseRef[];
  contextFrameId: ContextFrameId;
  skeletonId: SemanticSkeletonId;
  requiredCapabilityIds: readonly string[];
  containsGuidedSteps: boolean;
  containsAssessableSteps: boolean;
  reviewStatus: "REVIEWED";
  createPlan: (request?: PlanVariantRequest) => LearningExperiencePlan;
}
