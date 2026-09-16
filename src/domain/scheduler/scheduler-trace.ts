import type { LearningNeedReason } from "@/domain/learning/learning-need";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { PriorityBreakdown } from "./priority-breakdown";
import type { SchedulerBlockedReason } from "./scheduler-errors";

export type SchedulerCandidateStatus =
  | "GENERATED"
  | "BLOCKED"
  | "DEDUPLICATED"
  | "SELECTED"
  | "DEFERRED";

export interface SchedulerCandidateTrace {
  id: string;
  lexemeId: string;
  skill: VocabularySkill;
  reason: LearningNeedReason;
  sourceRuleId: string;
  explanation: string;
  priorityBreakdown?: PriorityBreakdown;
  status: SchedulerCandidateStatus;
  blockedReason?: SchedulerBlockedReason;
  capabilityReason?: string;
  mergedInto?: string;
}

export interface SchedulerQuotaDecision {
  kind: "MAX_NEW_WORDS" | "MIN_REVIEW_NEEDS" | "FILL_WITH_NEW_WORDS";
  detail: string;
}

export interface SchedulerDiversityDecision {
  kind: "DEFERRED" | "RELAXED";
  candidateId: string;
  detail: string;
}

export interface SchedulerTrace {
  generatedCandidates: SchedulerCandidateTrace[];
  blockedCandidates: SchedulerCandidateTrace[];
  deduplicatedCandidates: SchedulerCandidateTrace[];
  selectedCandidates: SchedulerCandidateTrace[];
  deferredCandidates: SchedulerCandidateTrace[];
  quotaDecisions: SchedulerQuotaDecision[];
  diversityDecisions: SchedulerDiversityDecision[];
}

export function emptySchedulerTrace(): SchedulerTrace {
  return {
    generatedCandidates: [],
    blockedCandidates: [],
    deduplicatedCandidates: [],
    selectedCandidates: [],
    deferredCandidates: [],
    quotaDecisions: [],
    diversityDecisions: [],
  };
}
