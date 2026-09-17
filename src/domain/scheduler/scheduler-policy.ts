import type { LearningNeedReason } from "@/domain/learning/learning-need";

export interface SchedulerPolicy {
  version: string;
  reasonWeights: Record<LearningNeedReason, number>;
  weakness: {
    severityWeight: number;
  };
  overdue: {
    maxBoost: number;
    daysToMaxBoost: number;
  };
  fading: {
    boost: number;
  };
  skillGap: {
    scoreWeight: number;
    confidenceWeight: number;
  };
  recency: {
    recentActivityWindow: number;
    sameLexemePenalty: number;
    sameSkillPenalty: number;
  };
  session: {
    defaultNeedCount: number;
    maxNewWords: number;
    minReviewNeeds: number;
  };
  diversity: {
    maxSameSkillInRow: number;
    maxSameReasonInRow: number;
  };
  progression: {
    /**
     * When true, STAGE_PROGRESS is omitted for a skill that already has a
     * recent independent success, no newer failure/weakness, and a future
     * nextReviewAt. UNSEEN / NEW_WORD admission is unchanged.
     */
    deferHealthyStageProgressUntilReviewDue: boolean;
  };
}

const SCHEDULER_POLICY_V1_NUMBERS = {
  reasonWeights: {
    WEAKNESS: 0.9,
    FADING: 0.82,
    USER_MARKED: 0.78,
    REVIEW_DUE: 0.65,
    STAGE_PROGRESS: 0.5,
    NEW_WORD: 0.3,
  },
  weakness: {
    severityWeight: 0.15,
  },
  overdue: {
    maxBoost: 0.12,
    daysToMaxBoost: 14,
  },
  fading: {
    boost: 0.1,
  },
  skillGap: {
    scoreWeight: 0.1,
    confidenceWeight: 0.05,
  },
  recency: {
    recentActivityWindow: 8,
    sameLexemePenalty: 0.12,
    sameSkillPenalty: 0.04,
  },
  session: {
    defaultNeedCount: 10,
    maxNewWords: 3,
    minReviewNeeds: 4,
  },
  diversity: {
    maxSameSkillInRow: 2,
    maxSameReasonInRow: 3,
  },
};

export const SCHEDULER_POLICY_V1: SchedulerPolicy = {
  version: "v1",
  ...SCHEDULER_POLICY_V1_NUMBERS,
  progression: {
    deferHealthyStageProgressUntilReviewDue: false,
  },
};

export const SCHEDULER_POLICY_V2: SchedulerPolicy = {
  version: "v2",
  ...SCHEDULER_POLICY_V1_NUMBERS,
  progression: {
    deferHealthyStageProgressUntilReviewDue: true,
  },
};

export const DEFAULT_SCHEDULER_POLICY = SCHEDULER_POLICY_V2;

export const PRIMARY_REASON_PRECEDENCE: readonly LearningNeedReason[] = [
  "WEAKNESS",
  "FADING",
  "USER_MARKED",
  "REVIEW_DUE",
  "STAGE_PROGRESS",
  "NEW_WORD",
] as const;

export const REVIEW_REASONS: readonly LearningNeedReason[] = [
  "WEAKNESS",
  "FADING",
  "REVIEW_DUE",
] as const;

export function isReviewReason(reason: LearningNeedReason): boolean {
  return REVIEW_REASONS.includes(reason);
}
