import type { LearningEvidence } from "../evidence.types";
import { MasteryStage } from "../mastery-stage";
import type { LearningPolicy } from "../policies/learning-policy";
import type { StudentWordModel } from "../student-word-model";
import type { TransitionReason } from "../transition.types";
import {
  contextVariantId,
  distinctPracticeDays,
  distinctSessions,
  distinctTaskTypes,
  isExposure,
  isFailure,
  isIndependentSuccess,
  isProductionIndependentSuccess,
} from "./evidence-helpers";
import { daysBetween } from "./time";
import { VocabularySkill } from "../vocabulary-skill";

export interface EvaluateStageTransitionInput {
  model: StudentWordModel;
  history: readonly LearningEvidence[];
  evidence: LearningEvidence;
  policy: LearningPolicy;
  now: string;
}

export interface StageTransitionEvaluation {
  nextStage: MasteryStage;
  reasons: TransitionReason[];
}

interface CheckResult {
  met: boolean;
  reason: TransitionReason;
}

function unmet(
  code: string,
  message: string,
  metadata: Record<string, unknown>,
  evidenceIds?: string[],
): CheckResult {
  return {
    met: false,
    reason: { code, message, metadata, evidenceIds },
  };
}

function met(
  code: string,
  message: string,
  metadata: Record<string, unknown>,
  evidenceIds?: string[],
): CheckResult {
  return {
    met: true,
    reason: { code, message, metadata, evidenceIds },
  };
}

function recognitionCheck(
  history: readonly LearningEvidence[],
  policy: LearningPolicy,
): CheckResult {
  const successes = history.filter(
    (item) =>
      policy.recognition.skills.includes(item.skill) &&
      isIndependentSuccess(item),
  );
  const sessions = distinctSessions(successes);
  const ok =
    successes.length >= policy.recognition.minIndependentSuccesses &&
    sessions >= policy.recognition.minDistinctSessions;
  const metadata = {
    independentSuccesses: successes.length,
    requiredSuccesses: policy.recognition.minIndependentSuccesses,
    sessions,
    requiredSessions: policy.recognition.minDistinctSessions,
  };
  return ok
    ? met(
        "RECOGNIZED_REQUIREMENTS_MET",
        "Independent recognition evidence spans multiple sessions",
        metadata,
        successes.map((item) => item.id),
      )
    : unmet(
        "RECOGNIZED_REQUIREMENTS_NOT_MET",
        "Need independent recognition success across multiple sessions",
        metadata,
        successes.map((item) => item.id),
      );
}

function connectionCheck(
  model: StudentWordModel,
  history: readonly LearningEvidence[],
  policy: LearningPolicy,
): CheckResult {
  const meaning =
    model.skills[VocabularySkill.MEANING_RECOGNITION].score;
  const semantic =
    model.skills[VocabularySkill.SEMANTIC_CONNECTION].score;
  const sessions = distinctSessions(history.filter(isExposure));
  const ok =
    meaning >= policy.connection.meaningRecognitionMinScore &&
    semantic >= policy.connection.semanticConnectionMinScore &&
    sessions >= policy.connection.minDistinctSessions;
  const metadata = {
    meaningRecognitionScore: meaning,
    requiredMeaningScore: policy.connection.meaningRecognitionMinScore,
    semanticConnectionScore: semantic,
    requiredSemanticScore: policy.connection.semanticConnectionMinScore,
    sessions,
    requiredSessions: policy.connection.minDistinctSessions,
  };
  return ok
    ? met("CONNECTED_REQUIREMENTS_MET", "Meaning and relation scores are ready", metadata)
    : unmet(
        "CONNECTED_REQUIREMENTS_NOT_MET",
        "Need stronger meaning/relation evidence across sessions",
        metadata,
      );
}

function recallCheck(
  model: StudentWordModel,
  history: readonly LearningEvidence[],
  policy: LearningPolicy,
): CheckResult {
  const production = history.filter((item) =>
    isProductionIndependentSuccess(item, policy),
  );
  const productionScore = Math.max(
    model.skills[VocabularySkill.ACTIVE_RECALL].score,
    model.skills[VocabularySkill.SPELLING_RECALL].score,
  );
  const sessions = distinctSessions(production);
  const ok =
    productionScore >= policy.recall.minScore &&
    production.length >= policy.recall.minIndependentSuccesses &&
    sessions >= policy.recall.minDistinctSessions;
  const metadata = {
    productionScore,
    requiredScore: policy.recall.minScore,
    independentProductionSuccesses: production.length,
    requiredSuccesses: policy.recall.minIndependentSuccesses,
    sessions,
    requiredSessions: policy.recall.minDistinctSessions,
    note: "Multiple-choice cannot satisfy active production",
  };
  return ok
    ? met(
        "RECALLED_REQUIREMENTS_MET",
        "Independent production evidence is present",
        metadata,
        production.map((item) => item.id),
      )
    : unmet(
        "RECALLED_REQUIREMENTS_NOT_MET",
        "Need unassisted typing/spelling production across sessions",
        metadata,
        production.map((item) => item.id),
      );
}

function usageCheck(
  model: StudentWordModel,
  history: readonly LearningEvidence[],
  policy: LearningPolicy,
): CheckResult {
  const contextSuccesses = history.filter(
    (item) =>
      item.skill === VocabularySkill.CONTEXT_USE && isIndependentSuccess(item),
  );
  const variants = new Set(
    contextSuccesses
      .map(contextVariantId)
      .filter((value): value is string => value !== null),
  );
  const score = model.skills[VocabularySkill.CONTEXT_USE].score;
  const ok =
    score >= policy.usage.contextUseMinScore &&
    variants.size >= policy.usage.minDistinctContextVariants &&
    contextSuccesses.length >= policy.usage.minIndependentSuccesses;
  const metadata = {
    contextUseScore: score,
    requiredScore: policy.usage.contextUseMinScore,
    variants: [...variants],
    requiredVariants: policy.usage.minDistinctContextVariants,
    independentSuccesses: contextSuccesses.length,
  };
  return ok
    ? met("USABLE_REQUIREMENTS_MET", "Context use is established across variants", metadata)
    : unmet(
        "USABLE_REQUIREMENTS_NOT_MET",
        "Need independent context use across different task variants",
        metadata,
      );
}

function masteryCheck(
  model: StudentWordModel,
  history: readonly LearningEvidence[],
  policy: LearningPolicy,
  now: string,
): CheckResult {
  const productionScore = Math.max(
    model.skills[VocabularySkill.ACTIVE_RECALL].score,
    model.skills[VocabularySkill.SPELLING_RECALL].score,
  );
  const independent = history.filter(isIndependentSuccess);
  const severeWeakness = model.weaknesses.find(
    (item) =>
      item.resolvedAt === null &&
      item.severity > policy.mastery.maxUnresolvedWeaknessSeverity,
  );
  const firstSeenAt = model.firstSeenAt ?? history[0]?.occurredAt ?? now;
  const elapsedDays = daysBetween(firstSeenAt, now);
  const ok =
    model.skills[VocabularySkill.MEANING_RECOGNITION].score >=
      policy.mastery.meaningRecognitionMinScore &&
    productionScore >= policy.mastery.productionMinScore &&
    model.skills[VocabularySkill.CONTEXT_USE].score >=
      policy.mastery.contextUseMinScore &&
    distinctPracticeDays(history) >= policy.mastery.minDistinctPracticeDays &&
    distinctTaskTypes(history) >= policy.mastery.minDistinctTaskTypes &&
    independent.length >= policy.mastery.minIndependentSuccesses &&
    elapsedDays >= policy.mastery.minDaysSinceFirstSeen &&
    !severeWeakness;

  const metadata = {
    meaningRecognitionScore:
      model.skills[VocabularySkill.MEANING_RECOGNITION].score,
    productionScore,
    contextUseScore: model.skills[VocabularySkill.CONTEXT_USE].score,
    distinctPracticeDays: distinctPracticeDays(history),
    distinctTaskTypes: distinctTaskTypes(history),
    independentSuccesses: independent.length,
    elapsedDays,
    severeWeaknessId: severeWeakness?.id ?? null,
  };

  return ok
    ? met(
        "MASTERED_REQUIREMENTS_MET",
        "Multiple skills, tasks, and calendar days support mastery",
        metadata,
      )
    : unmet(
        "MASTERED_REQUIREMENTS_NOT_MET",
        "Mastery requires time span, diverse evidence, and no severe weakness",
        metadata,
      );
}

function demotionCheck(
  stage: MasteryStage,
  history: readonly LearningEvidence[],
  policy: LearningPolicy,
): CheckResult {
  if (stage !== MasteryStage.MASTERED && stage !== MasteryStage.USABLE) {
    return unmet("DEMOTION_NOT_APPLICABLE", "V1 only demotes MASTERED or USABLE", {
      stage,
    });
  }
  const window = history.slice(-policy.mastery.demotionRecentWindow);
  const failures = window.filter(isFailure);
  const sessions = distinctSessions(failures);
  const ok =
    failures.length >= policy.mastery.demotionMinFailures &&
    sessions >= policy.mastery.demotionMinFailureSessions;
  const metadata = {
    recentFailures: failures.length,
    requiredFailures: policy.mastery.demotionMinFailures,
    failureSessions: sessions,
    requiredSessions: policy.mastery.demotionMinFailureSessions,
  };
  return ok
    ? met(
        "DEMOTION_REQUIREMENTS_MET",
        "Sustained failures across sessions justify a conservative demotion",
        metadata,
        failures.map((item) => item.id),
      )
    : unmet(
        "DEMOTION_REQUIREMENTS_NOT_MET",
        "A single failure is not enough to drop mastery stage",
        metadata,
      );
}

function nextPromotionTarget(stage: MasteryStage): MasteryStage | null {
  switch (stage) {
    case MasteryStage.UNSEEN:
      return MasteryStage.EXPOSED;
    case MasteryStage.EXPOSED:
      return MasteryStage.RECOGNIZED;
    case MasteryStage.RECOGNIZED:
      return MasteryStage.CONNECTED;
    case MasteryStage.CONNECTED:
      return MasteryStage.RECALLED;
    case MasteryStage.RECALLED:
      return MasteryStage.USABLE;
    case MasteryStage.USABLE:
      return MasteryStage.MASTERED;
    case MasteryStage.MASTERED:
      return null;
  }
}

export function evaluateStageTransition(
  input: EvaluateStageTransitionInput,
): StageTransitionEvaluation {
  const { model, history, evidence, policy, now } = input;
  const current = model.masteryStage;
  const reasons: TransitionReason[] = [];

  const demotion = demotionCheck(current, history, policy);
  if (demotion.met) {
    const nextStage =
      current === MasteryStage.MASTERED
        ? MasteryStage.USABLE
        : MasteryStage.RECALLED;
    reasons.push({
      ...demotion.reason,
      code:
        current === MasteryStage.MASTERED
          ? "DEMOTED_MASTERED_TO_USABLE"
          : "DEMOTED_USABLE_TO_RECALLED",
      message:
        current === MasteryStage.MASTERED
          ? "Sustained cross-session failures demoted MASTERED to USABLE"
          : "Sustained cross-session failures demoted USABLE to RECALLED",
    });
    return { nextStage, reasons };
  }
  if (
    current === MasteryStage.MASTERED ||
    current === MasteryStage.USABLE
  ) {
    reasons.push(demotion.reason);
  }

  if (current === MasteryStage.UNSEEN) {
    if (isExposure(evidence)) {
      reasons.push({
        code: "PROMOTED_UNSEEN_TO_EXPOSED",
        message: "First non-skipped interaction exposed the word",
        evidenceIds: [evidence.id],
      });
      return { nextStage: MasteryStage.EXPOSED, reasons };
    }
    reasons.push({
      code: "EXPOSURE_NOT_MET",
      message: "SKIPPED does not count as first exposure",
      evidenceIds: [evidence.id],
    });
    return { nextStage: current, reasons };
  }

  const target = nextPromotionTarget(current);
  if (!target) {
    return { nextStage: current, reasons };
  }

  const check =
    target === MasteryStage.RECOGNIZED
      ? recognitionCheck(history, policy)
      : target === MasteryStage.CONNECTED
        ? connectionCheck(model, history, policy)
        : target === MasteryStage.RECALLED
          ? recallCheck(model, history, policy)
          : target === MasteryStage.USABLE
            ? usageCheck(model, history, policy)
            : masteryCheck(model, history, policy, now);

  reasons.push(
    check.met
      ? {
          ...check.reason,
          code: `PROMOTED_${current}_TO_${target}`,
          message: `Advanced from ${current} to ${target}`,
        }
      : check.reason,
  );

  return {
    nextStage: check.met ? target : current,
    reasons,
  };
}
