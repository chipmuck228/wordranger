export type {
  LearningNeedCandidate,
  UserMarkedLexeme,
  RecentLearningActivity,
  SchedulerLexemeRef,
} from "./learning-need-candidate";
export {
  DEFAULT_SCHEDULER_POLICY,
  SCHEDULER_POLICY_V1,
  SCHEDULER_POLICY_V2,
  PRIMARY_REASON_PRECEDENCE,
  REVIEW_REASONS,
  isReviewReason,
  type SchedulerPolicy,
} from "./scheduler-policy";
export {
  learningNeedReasons,
  learningNeedHasReason,
  isNewIntroductionNeed,
  isReviewNeed,
} from "./need-classification";
export {
  DefaultLearningContentCapability,
  MappedLearningContentCapability,
  DEFAULT_LEARNING_CONTENT_CAPABILITY,
  lexemeCapability,
  skillGloballySupported,
  type LearningContentCapability,
  type LexemeLearningCapability,
} from "./learning-content-capability";
export { shouldDeferHealthyStageProgress } from "./stage-progress-deferral";
export { targetSkillForWeakness } from "./weakness-skill-map";
export {
  weakerSkill,
  weakestPracticedSkill,
  selectStageProgressSkill,
  selectReviewSkill,
  fallbackSkillForUnsupported,
  selectFadingRecoverySkill,
  selectFadingRecoveryFallbackSkill,
} from "./stage-skill-map";
export { SchedulerBlockedReason, SchedulerError } from "./scheduler-errors";
export {
  assemblePriority,
  type PriorityBreakdown,
} from "./priority-breakdown";
export {
  scoreCandidate,
  avoidRecentTaskTypesForLexeme,
} from "./score-candidate";
export {
  DefaultLearningNeedGenerator,
  type LearningNeedGenerator,
  type LearningNeedGenerationInput,
} from "./learning-need-generator";
export { candidateKey, dedupeCandidates } from "./candidate-dedup";
export type { ScoredCandidate, DedupedNeed } from "./candidate-dedup";
export {
  emptySchedulerTrace,
  type SchedulerTrace,
  type SchedulerCandidateTrace,
  type SchedulerCandidateStatus,
  type SchedulerQuotaDecision,
  type SchedulerDiversityDecision,
} from "./scheduler-trace";
export {
  preferredPromptModesForSkill,
  type LearningSessionPlan,
} from "./session-plan";
export {
  DeterministicScheduler,
  type LearningScheduler,
  type SchedulerInput,
} from "./deterministic-scheduler";
