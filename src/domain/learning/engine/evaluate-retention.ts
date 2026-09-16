import type { LearningEvidence } from "../evidence.types";
import { isAtLeastStage, type MasteryStage } from "../mastery-stage";
import type { LearningPolicy } from "../policies/learning-policy";
import { RetentionState } from "../retention-state";
import type { SkillState } from "../student-word-model";
import type { TransitionReason } from "../transition.types";
import {
  isFailure,
  isIndependentSuccess,
} from "./evidence-helpers";

export interface EvaluateRetentionInput {
  previousRetentionState: RetentionState;
  stage: MasteryStage;
  evidence: LearningEvidence;
  history: readonly LearningEvidence[];
  previousSkill?: SkillState;
  updatedSkill: SkillState;
  nextReviewAt: string | null;
  policy: LearningPolicy;
  now: string;
}

export interface RetentionEvaluation {
  nextRetentionState: RetentionState;
  reasons: TransitionReason[];
}

function fadingSignals(input: EvaluateRetentionInput): TransitionReason[] {
  const reasons: TransitionReason[] = [];
  const {
    stage,
    evidence,
    previousSkill,
    updatedSkill,
    nextReviewAt,
    policy,
    now,
  } = input;

  if (
    isFailure(evidence) &&
    isAtLeastStage(stage, policy.retention.fadingOnFailureMinStage)
  ) {
    reasons.push({
      code: "FADING_HIGH_STAGE_FAILURE",
      message: "A high-stage word produced a failure signal",
      evidenceIds: [evidence.id],
      metadata: { stage },
    });
  }

  if (
    isFailure(evidence) &&
    nextReviewAt !== null &&
    Date.parse(now) >= Date.parse(nextReviewAt)
  ) {
    reasons.push({
      code: "FADING_OVERDUE_FAILURE",
      message: "Review was due or overdue and the attempt failed",
      evidenceIds: [evidence.id],
      metadata: { nextReviewAt },
    });
  }

  if (
    previousSkill &&
    previousSkill.score - updatedSkill.score >= policy.retention.fadingScoreDrop
  ) {
    reasons.push({
      code: "FADING_SCORE_DROP",
      message: "Skill score dropped enough to signal forgetting",
      evidenceIds: [evidence.id],
      metadata: {
        previousScore: previousSkill.score,
        nextScore: updatedSkill.score,
        skill: updatedSkill.skill,
      },
    });
  }

  return reasons;
}

function recoveryAnchorSession(
  historyBeforeCurrent: readonly LearningEvidence[],
): string | null {
  let lastFailureIndex = -1;
  for (let index = historyBeforeCurrent.length - 1; index >= 0; index -= 1) {
    const item = historyBeforeCurrent[index];
    if (item && isFailure(item)) {
      lastFailureIndex = index;
      break;
    }
  }
  if (lastFailureIndex < 0) {
    const firstSuccess = historyBeforeCurrent.find(isIndependentSuccess);
    return firstSuccess?.sessionId ?? null;
  }
  const recovery = historyBeforeCurrent
    .slice(lastFailureIndex + 1)
    .find(isIndependentSuccess);
  return recovery?.sessionId ?? null;
}

export function evaluateRetention(
  input: EvaluateRetentionInput,
): RetentionEvaluation {
  const { previousRetentionState, evidence, history, policy } = input;
  const independentSuccesses = history.filter(isIndependentSuccess);
  const fadeReasons = fadingSignals(input);

  if (previousRetentionState === RetentionState.NEW) {
    if (
      independentSuccesses.length >=
      policy.retention.minIndependentSuccessesForStable
    ) {
      return {
        nextRetentionState: RetentionState.STABLE,
        reasons: [
          {
            code: "RETENTION_NEW_TO_STABLE",
            message: "Enough independent successes to treat memory as stable",
            evidenceIds: independentSuccesses.map((item) => item.id),
          },
        ],
      };
    }
    return {
      nextRetentionState: RetentionState.NEW,
      reasons: [
        {
          code: "RETENTION_STILL_NEW",
          message: "Not enough stable learning evidence yet",
        },
      ],
    };
  }

  if (previousRetentionState === RetentionState.STABLE) {
    if (fadeReasons.length > 0) {
      return {
        nextRetentionState: RetentionState.FADING,
        reasons: fadeReasons,
      };
    }
    return {
      nextRetentionState: RetentionState.STABLE,
      reasons: [
        {
          code: "RETENTION_REMAINS_STABLE",
          message: "No forgetting signal on this evidence",
          evidenceIds: [evidence.id],
        },
      ],
    };
  }

  if (previousRetentionState === RetentionState.FADING) {
    if (isIndependentSuccess(evidence)) {
      return {
        nextRetentionState: RetentionState.RECOVERING,
        reasons: [
          {
            code: "RETENTION_FADING_TO_RECOVERING",
            message:
              "First independent success after fading starts recovery, not immediate stability",
            evidenceIds: [evidence.id],
          },
        ],
      };
    }
    return {
      nextRetentionState: RetentionState.FADING,
      reasons: fadeReasons.length
        ? fadeReasons
        : [
            {
              code: "RETENTION_STILL_FADING",
              message: "Fading continues until an independent success",
              evidenceIds: [evidence.id],
            },
          ],
    };
  }

  if (isIndependentSuccess(evidence)) {
    const historyBeforeCurrent = history.filter(
      (item) => item.id !== evidence.id,
    );
    const anchorSession = recoveryAnchorSession(historyBeforeCurrent);
    const differentSession =
      !policy.retention.recoveringRequiresDifferentSession ||
      (anchorSession !== null && anchorSession !== evidence.sessionId);
    if (differentSession) {
      return {
        nextRetentionState: RetentionState.STABLE,
        reasons: [
          {
            code: "RETENTION_RECOVERING_TO_STABLE",
            message:
              "A later independent success in a different session restored stability",
            evidenceIds: [evidence.id],
            metadata: { previousRecoverySessionId: anchorSession },
          },
        ],
      };
    }
    return {
      nextRetentionState: RetentionState.RECOVERING,
      reasons: [
        {
          code: "RETENTION_RECOVERY_NEEDS_NEW_SESSION",
          message:
            "Recovery requires another independent success in a different session",
          evidenceIds: [evidence.id],
          metadata: { previousRecoverySessionId: anchorSession },
        },
      ],
    };
  }

  if (isFailure(evidence)) {
    return {
      nextRetentionState: RetentionState.FADING,
      reasons: [
        {
          code: "RETENTION_RECOVERING_TO_FADING",
          message: "Failure during recovery sent the word back to fading",
          evidenceIds: [evidence.id],
        },
      ],
    };
  }

  return {
    nextRetentionState: RetentionState.RECOVERING,
    reasons: [
      {
        code: "RETENTION_STILL_RECOVERING",
        message: "Recovery is in progress",
        evidenceIds: [evidence.id],
      },
    ],
  };
}
