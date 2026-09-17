/**
 * Contextual Learning Domain Model Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * These types sit between a frozen LearningNeed reference and compilation
 * into a frozen PublicLearningTask. They do not grade and do not update
 * StudentLexemeModel.
 */

import type {
  SemanticEffect,
  SemanticFact,
  SemanticPredicate,
  SemanticQuery,
} from "./predicates";
import type { Provenance, ReviewStatus } from "./provenance";

export type {
  SemanticEffect,
  SemanticFact,
  SemanticPredicate,
  SemanticQuery,
  SemanticValue,
} from "./predicates";

export type LexemeId = string;
export type LexemeSenseId = string;
export type SemanticConceptId = string;
export type SemanticRoleId = string;
export type SemanticRelationId = string;
export type SemanticSkeletonId = string;
export type ContextFrameId = string;
export type ContextEntityId = string;
export type ContextEventId = string;
export type SupportBlockId = string;
export type ExperienceId = string;
export type ExperienceStepId = string;

/** Internal to the contextual layer. Not a Learning Core state. */
export type CognitiveMode = "PROBE" | "BUILD" | "STRENGTHEN" | "RETRIEVE";

export type ContextKind =
  | "PHYSICAL"
  | "EVENT"
  | "SOCIAL"
  | "PROCEDURAL"
  | "DOMAIN"
  | "CONCEPTUAL"
  | "DISCOURSE";

/** Renderer-independent semantic actions. No CLICK / TAP / DRAG. */
export type SemanticAction =
  | "IDENTIFY"
  | "SELECT"
  | "MATCH"
  | "CLASSIFY"
  | "ORDER"
  | "PLACE"
  | "CONNECT"
  | "COMPARE"
  | "DISTINGUISH"
  | "PREDICT"
  | "CHANGE"
  | "OBSERVE"
  | "EXPLAIN"
  | "RECALL"
  | "TYPE";

export interface LexemeSenseRef {
  lexemeId: LexemeId;
  senseId: LexemeSenseId;
}

export interface SemanticConcept {
  id: SemanticConceptId;
  label: string;
  kind:
    | "ENTITY_TYPE"
    | "ACTION"
    | "PROPERTY"
    | "RELATION"
    | "STATE"
    | "OUTCOME"
    | "CLAIM";
  gloss: string;
  provenance: Provenance;
}

export interface SenseRelation {
  type:
    | "SYNONYM"
    | "ANTONYM"
    | "CONFUSABLE"
    | "WORD_FAMILY"
    | "BROADER"
    | "NARROWER"
    | "ASSOCIATED";
  target: LexemeSenseRef;
}

export interface SenseSemanticProfile {
  sense: LexemeSenseRef;
  displayForm: string;
  expresses: SemanticConceptId[];
  functions?: SemanticConceptId[];
  relatedSenses?: SenseRelation[];
  contrastSetIds?: string[];
  misconceptionIds?: string[];
  supportBlockIds?: SupportBlockId[];
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

export interface SemanticDiscriminator {
  id: string;
  dimension: string;
  rule: SemanticPredicate;
  explanationSupportId?: SupportBlockId;
}

export interface ContrastSet {
  id: string;
  members: LexemeSenseRef[];
  discriminators: SemanticDiscriminator[];
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

export interface Misconception {
  id: string;
  appliesTo: LexemeSenseRef[];
  incorrectClaim: SemanticPredicate;
  correction: SemanticPredicate;
  supportBlockId: SupportBlockId;
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

export interface RoleDefinition {
  id: SemanticRoleId;
  label: string;
  cardinality: "ONE" | "OPTIONAL_ONE" | "MANY";
  accepts: SemanticPredicate[];
}

export interface RelationDefinition {
  id: SemanticRelationId;
  label: string;
  fromRole: SemanticRoleId;
  toRole: SemanticRoleId;
  directionality: "DIRECTED" | "SYMMETRIC";
  temporalScope: "STATE" | "EVENT" | "PERSISTENT";
}

export interface StateDefinition {
  id: string;
  subjectRole: SemanticRoleId;
  property: string;
  valueType: "BOOLEAN" | "ENUM" | "NUMBER" | "REFERENCE";
}

export interface EventDefinition {
  id: string;
  participantRoles: SemanticRoleId[];
  preconditions: SemanticPredicate[];
  effects: SemanticEffect[];
}

export interface ConstraintDefinition {
  id: string;
  description: string;
  predicate: SemanticPredicate;
}

export interface GoalDefinition {
  id: string;
  description: string;
  successPredicate: SemanticPredicate;
}

export interface AffordanceDefinition {
  id: string;
  actorRole: SemanticRoleId;
  action: SemanticAction;
  objectRole?: SemanticRoleId;
  enabledWhen: SemanticPredicate[];
  possibleEffects?: SemanticEffect[];
}

export interface SkeletonValidationRule {
  id: string;
  description: string;
  predicate: SemanticPredicate;
}

export interface SemanticSkeleton {
  id: SemanticSkeletonId;
  version: number;
  title: string;
  description: string;
  supportedContextKinds: ContextKind[];
  roleDefinitions: RoleDefinition[];
  relationDefinitions: RelationDefinition[];
  stateDefinitions?: StateDefinition[];
  eventDefinitions?: EventDefinition[];
  constraintDefinitions?: ConstraintDefinition[];
  affordanceDefinitions?: AffordanceDefinition[];
  goalDefinitions: GoalDefinition[];
  validationRules: SkeletonValidationRule[];
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

export type ContextLexemeBindingKind =
  | "NAMES_ENTITY"
  | "NAMES_ACTION"
  | "NAMES_PROPERTY"
  | "NAMES_RELATION"
  | "NAMES_STATE"
  | "NAMES_OUTCOME"
  | "EXPRESSES_CLAIM";

export interface ContextLexemeBinding {
  sense: LexemeSenseRef;
  bindingKind: ContextLexemeBindingKind;
}

export interface EntityBinding {
  entityId: ContextEntityId;
  roleId: SemanticRoleId;
  label: string;
  conceptIds: SemanticConceptId[];
  lexemeSenseBindings?: ContextLexemeBinding[];
  attributes?: Record<string, string | number | boolean>;
}

export interface PerspectiveBinding {
  eventId: string;
  observerRole: SemanticRoleId;
  expressedSense: LexemeSenseRef;
  requiredDirection: {
    sourceRole: SemanticRoleId;
    destinationRole: SemanticRoleId;
  };
}

export interface ClaimGrounding {
  sense: LexemeSenseRef;
  claim: SemanticPredicate;
  supportingFacts: SemanticPredicate[];
  /**
   * Local scope that prevents overgeneral claims such as
   * "this learner has high general ability".
   */
  scopedTo?: SemanticPredicate;
}

export interface EventBinding {
  eventId: ContextEventId;
  participantEntityIds: Record<string, ContextEntityId>;
  beforeFacts: SemanticFact[];
  afterFacts: SemanticFact[];
}

export interface GoalBinding {
  goalId: string;
  active: boolean;
}

export interface ContextNarrative {
  setup: string;
  eventDescriptions?: Record<ContextEventId, string>;
}

export interface ContextFrame {
  id: ContextFrameId;
  skeletonId: SemanticSkeletonId;
  title: string;
  kinds: ContextKind[];
  locale: string;
  entityBindings: EntityBinding[];
  initialFacts: SemanticFact[];
  eventBindings?: EventBinding[];
  goalBindings: GoalBinding[];
  narrative?: ContextNarrative;
  allowedSemanticActions: SemanticAction[];
  perspectiveBindings?: PerspectiveBinding[];
  claimGroundings?: ClaimGrounding[];
  contentTags: string[];
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

export interface ResolvedContextSnapshot {
  contextFrameId: ContextFrameId;
  skeletonId: SemanticSkeletonId;
  entityBindings: EntityBinding[];
  facts: SemanticFact[];
  activeGoalId: string;
  allowedSemanticActions: SemanticAction[];
  sourceVersions: Record<string, number>;
}

export type SupportType =
  | "HINT"
  | "EXPLANATION"
  | "EXAMPLE"
  | "COUNTER_EXAMPLE"
  | "CONTRAST"
  | "MISCONCEPTION"
  | "ANALOGY"
  | "EXTENSION";

export type SupportRevealCost = "NONE" | "LOW" | "MEDIUM" | "ANSWER_REVEALING";

export type SupportContent =
  | { kind: "TEXT"; text: string }
  | { kind: "SEMANTIC_CUE"; predicates: SemanticPredicate[] }
  | { kind: "CONTRAST"; contrastSetId: string; focus: string }
  | { kind: "PARTIAL_LEXICAL_CUE"; pattern: string }
  | { kind: "EXAMPLE_CONTEXT"; contextFrameId: ContextFrameId };

export interface SupportBlock {
  id: SupportBlockId;
  type: SupportType;
  appliesToModes: CognitiveMode[];
  targetSenseIds: LexemeSenseId[];
  content: SupportContent;
  revealCost: SupportRevealCost;
  provenance: Provenance;
  reviewStatus: ReviewStatus;
}

export interface SupportLevel {
  level: 0 | 1 | 2 | 3 | 4;
  trigger: "ON_REQUEST" | "AFTER_FAILED_ATTEMPT" | "AFTER_N_FAILURES";
  supportBlockIds: SupportBlockId[];
  permitsAnotherAttempt: boolean;
}

export interface StepSupportPolicy {
  initialSupportBlockIds: SupportBlockId[];
  ladder: SupportLevel[];
  optionalExtensionBlockIds?: SupportBlockId[];
}

export type ExperienceTargetFocus =
  | "FORM_TO_MEANING"
  | "MEANING_TO_FORM"
  | "CONTEXT_INTERPRETATION"
  | "DISCRIMINATION"
  | "RELATION_USE";

export interface ExperienceTarget {
  id: string;
  sense: LexemeSenseRef;
  focus: ExperienceTargetFocus;
  requiredRoleIds?: SemanticRoleId[];
  requiredRelationIds?: SemanticRelationId[];
}

export interface PromptIntent {
  instructionKey: string;
  semanticQuestion: SemanticPredicate | SemanticQuery;
  mustNotRevealTargetForm?: boolean;
}

export type ExpectedSemanticResponse =
  | { kind: "ENTITY_REF"; allowedEntityIds: ContextEntityId[] }
  | { kind: "RELATION_CHOICE"; allowedRelationIds: SemanticRelationId[] }
  | { kind: "ORDERED_ENTITY_REFS"; allowedSequences: ContextEntityId[][] }
  | { kind: "LEXICAL_FORM"; sense: LexemeSenseRef }
  | { kind: "SEMANTIC_CLASS"; allowedConceptIds: SemanticConceptId[] }
  | { kind: "CLAIM_CHOICE"; allowedPredicates: SemanticPredicate[] };

export type ExpectedSemanticResponseKind = ExpectedSemanticResponse["kind"];

export type ExperienceStepPurpose =
  | "GROUND"
  | "CONNECT"
  | "DISCRIMINATE"
  | "GENERATE"
  | "RECALL"
  | "TRANSFER"
  | "OBSERVE";

export interface StepTransitionPolicy {
  onTaskCompleted: "NEXT" | "END";
  onSupportExhausted: "NEXT" | "END" | "USE_PREAUTHORED_FALLBACK_STEP";
  fallbackStepId?: ExperienceStepId;
}

export interface ExperienceStepSpec {
  id: ExperienceStepId;
  purpose: ExperienceStepPurpose;
  targetIds: string[];
  semanticAction: SemanticAction;
  promptIntent: PromptIntent;
  expectedResponse: ExpectedSemanticResponse;
  supportPolicy: StepSupportPolicy;
  requiredCapabilities: string[];
  transition: StepTransitionPolicy;
}

export interface ExperienceCompletionPolicy {
  requiredStepIds: ExperienceStepId[];
  terminalStepIds: ExperienceStepId[];
  onCompilationFailure: "ABORT_PLAN" | "SELECT_COMPATIBLE_VARIANT";
}

export interface LearningExperiencePlan {
  id: ExperienceId;
  schemaVersion: "candidate-v0";
  mode: CognitiveMode;
  sourceLearningNeedRef: string;
  targets: ExperienceTarget[];
  skeletonId: SemanticSkeletonId;
  contextFrameId: ContextFrameId;
  activeGoalId: string;
  steps: ExperienceStepSpec[];
  completionPolicy: ExperienceCompletionPolicy;
  provenance: Provenance;
}

export interface ResolvedTargetSnapshot {
  targetId: string;
  sense: LexemeSenseRef;
  displayForm: string;
  focus: ExperienceTargetFocus;
}

export interface RuntimeCapability {
  id: string;
  supportsAction: SemanticAction;
  responseKinds: ExpectedSemanticResponseKind[];
  maxOptions?: number;
  supportsContextSnapshot: boolean;
  supportsHintReveal: boolean;
  compilerId: string;
}

export type FrozenLearningNeedRef = string;
export type FrozenStudentLexemeModelRef = string;

export interface ExperiencePlanningInput {
  learningNeedRef: FrozenLearningNeedRef;
  learnerStateRef: FrozenStudentLexemeModelRef;
  mode: CognitiveMode;
  targets: ExperienceTarget[];
  allowedContextIds?: ContextFrameId[];
  runtimeCapabilities: RuntimeCapability[];
}

export interface CompilationTrace {
  experienceId: ExperienceId;
  stepId: ExperienceStepId;
  contextFrameId: ContextFrameId;
  skeletonId: SemanticSkeletonId;
  targetSenseIds: LexemeSenseId[];
  capabilityId: string;
  compilerId: string;
  sourceContentIds: string[];
}

export const DIRECTIONAL_SENSE_MARKERS = ["borrow", "lend"] as const;

export const ABSTRACT_CLAIM_BINDING_KINDS: readonly ContextLexemeBindingKind[] =
  ["EXPRESSES_CLAIM"] as const;

export const FORBIDDEN_RENDERER_ACTIONS = [
  "CLICK",
  "TAP",
  "DRAG",
  "PRESS_BUTTON",
  "OPEN_MODAL",
] as const;
