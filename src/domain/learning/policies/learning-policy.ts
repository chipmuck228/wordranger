import type { AnswerMode, EvidenceOutcome } from "../evidence.types";
import type { MasteryStage } from "../mastery-stage";
import type { VocabularySkill } from "../vocabulary-skill";

export interface SkillUpdatePolicy {
  ewmaAlpha: number;
  skippedEwmaAlpha: number;
  recentPerformanceLimit: number;
  outcomeTargetScores: Record<EvidenceOutcome, number>;
  answerModeWeights: Record<AnswerMode, number>;
  /**
   * Mixes answer-mode weight toward 1 so MC is discounted without collapsing
   * independent success scores.
   */
  answerModeNeutralFloor: number;
  /**
   * How strongly difficulty (0..1) shifts the target around 1.0.
   * 0.1 means difficulty 0 → 0.95x and difficulty 1 → 1.05x.
   */
  difficultyInfluence: number;
}

export interface ConfidencePolicy {
  skillAttemptDenom: number;
  skillIndependentDenom: number;
  skillSessionDenom: number;
  skillDayDenom: number;
  skillWeights: {
    attempts: number;
    independent: number;
    sessions: number;
    days: number;
  };
  masteryEvidenceDenom: number;
  masterySessionDenom: number;
  masteryDayDenom: number;
  masteryTaskTypeDenom: number;
  masteryIndependentDenom: number;
  masteryWeights: {
    evidence: number;
    sessions: number;
    days: number;
    taskTypes: number;
    independent: number;
  };
}

export interface RecognitionPolicy {
  minIndependentSuccesses: number;
  minDistinctSessions: number;
  skills: VocabularySkill[];
}

export interface ConnectionPolicy {
  meaningRecognitionMinScore: number;
  semanticConnectionMinScore: number;
  minDistinctSessions: number;
}

export interface RecallPolicy {
  minScore: number;
  minIndependentSuccesses: number;
  minDistinctSessions: number;
  productionSkills: VocabularySkill[];
  productionAnswerModes: AnswerMode[];
}

export interface UsagePolicy {
  contextUseMinScore: number;
  minDistinctContextVariants: number;
  minIndependentSuccesses: number;
}

export interface MasteryPolicy {
  meaningRecognitionMinScore: number;
  productionMinScore: number;
  contextUseMinScore: number;
  minDistinctPracticeDays: number;
  minDistinctTaskTypes: number;
  minIndependentSuccesses: number;
  minDaysSinceFirstSeen: number;
  maxUnresolvedWeaknessSeverity: number;
  skillWeights: Record<VocabularySkill, number>;
  demotionRecentWindow: number;
  demotionMinFailures: number;
  demotionMinFailureSessions: number;
}

export interface WeaknessPolicy {
  repeatedErrorWindow: number;
  repeatedErrorMinFailures: number;
  hintDependencyWindow: number;
  hintDependencyMinAssisted: number;
  confusionMinCount: number;
  spellingErrorWindow: number;
  spellingErrorMinCount: number;
  slowResponseRelativeMultiplier: number;
  slowResponseFallbackMs: number;
  slowResponseMinBaselineSamples: number;
  instabilityWindow: number;
  instabilityMinAlternations: number;
  recoveryIndependentSuccesses: number;
  recoverySeverityDecay: number;
  resolveSeverityThreshold: number;
  triggerSeverityStep: number;
  initialSeverity: number;
}

export interface RetentionPolicy {
  minIndependentSuccessesForStable: number;
  fadingOnFailureMinStage: MasteryStage;
  fadingScoreDrop: number;
  recoveringRequiresDifferentSession: boolean;
}

export interface ReviewPolicy {
  intervalDaysByStage: Record<MasteryStage, number>;
  fadingMultiplier: number;
  recoveringMultiplier: number;
}

export interface LearningPolicy {
  version: string;
  skillUpdate: SkillUpdatePolicy;
  confidence: ConfidencePolicy;
  recognition: RecognitionPolicy;
  connection: ConnectionPolicy;
  recall: RecallPolicy;
  usage: UsagePolicy;
  mastery: MasteryPolicy;
  weakness: WeaknessPolicy;
  retention: RetentionPolicy;
  review: ReviewPolicy;
}
