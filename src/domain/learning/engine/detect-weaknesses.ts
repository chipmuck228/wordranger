import type { LearningEvidence } from "../evidence.types";
import { EvidenceOutcome } from "../evidence.types";
import type { LearningPolicy } from "../policies/learning-policy";
import type { TransitionReason } from "../transition.types";
import type { Weakness } from "../weakness.types";
import { WeaknessType } from "../weakness.types";
import { clamp01 } from "./math";
import {
  countAlternations,
  isAssistedCorrect,
  isFailure,
  isIndependentSuccess,
  isSkipped,
  isSpellingErrorType,
  median,
  skillEvidence,
  weaknessTypeForSkill,
} from "./evidence-helpers";

export interface DetectWeaknessesInput {
  currentWeaknesses: Weakness[];
  history: readonly LearningEvidence[];
  evidence: LearningEvidence;
  policy: LearningPolicy;
  now: string;
  createId: () => string;
}

export interface DetectWeaknessesResult {
  weaknesses: Weakness[];
  added: Weakness[];
  resolvedIds: string[];
  reasons: TransitionReason[];
}

interface WeaknessDraft {
  type: WeaknessType;
  skill?: Weakness["skill"];
  relatedWordId?: string;
  reasonCode: string;
  message: string;
  metadata?: Record<string, unknown>;
}

function identityKey(input: {
  type: WeaknessType;
  skill?: Weakness["skill"];
  relatedWordId?: string;
}): string {
  if (input.type === WeaknessType.CONFUSION) {
    return `${input.type}:${input.relatedWordId ?? ""}`;
  }
  return `${input.type}:${input.skill ?? ""}`;
}

function upsertWeakness(
  existing: Weakness[],
  draft: WeaknessDraft,
  evidence: LearningEvidence,
  now: string,
  policy: LearningPolicy,
  createId: () => string,
): { weaknesses: Weakness[]; added: Weakness | null; updated: boolean } {
  const key = identityKey(draft);
  const unresolvedIndex = existing.findIndex(
    (item) => item.resolvedAt === null && identityKey(item) === key,
  );

  if (unresolvedIndex >= 0) {
    const current = existing[unresolvedIndex];
    const next: Weakness = {
      ...current,
      severity: clamp01(current.severity + policy.weakness.triggerSeverityStep),
      lastTriggeredAt: now,
      reason: {
        ...current.reason,
        evidenceIds: current.reason.evidenceIds.includes(evidence.id)
          ? current.reason.evidenceIds
          : [...current.reason.evidenceIds, evidence.id],
        metadata: {
          ...current.reason.metadata,
          ...draft.metadata,
        },
      },
    };
    const weaknesses = [...existing];
    weaknesses[unresolvedIndex] = next;
    return { weaknesses, added: null, updated: true };
  }

  const created: Weakness = {
    id: createId(),
    type: draft.type,
    severity: clamp01(policy.weakness.initialSeverity),
    skill: draft.skill,
    relatedWordId: draft.relatedWordId,
    reason: {
      code: draft.reasonCode,
      evidenceIds: [evidence.id],
      message: draft.message,
      metadata: draft.metadata,
    },
    detectedAt: now,
    lastTriggeredAt: now,
    resolvedAt: null,
  };

  return {
    weaknesses: [...existing, created],
    added: created,
    updated: false,
  };
}

function recoverWeaknesses(
  weaknesses: Weakness[],
  history: readonly LearningEvidence[],
  evidence: LearningEvidence,
  policy: LearningPolicy,
  now: string,
): { weaknesses: Weakness[]; resolvedIds: string[]; reasons: TransitionReason[] } {
  const resolvedIds: string[] = [];
  const reasons: TransitionReason[] = [];

  const next = weaknesses.map((weakness) => {
    if (weakness.resolvedAt) {
      return weakness;
    }
    const relevantSkill = weakness.skill ?? evidence.skill;
    const recentIndependent = skillEvidence(history, relevantSkill)
      .filter(isIndependentSuccess)
      .slice(-policy.weakness.recoveryIndependentSuccesses);
    const recoveredNow =
      isIndependentSuccess(evidence) &&
      recentIndependent.length >= policy.weakness.recoveryIndependentSuccesses &&
      (weakness.skill === undefined || weakness.skill === evidence.skill);

    if (!recoveredNow) {
      return weakness;
    }

    const severity = clamp01(
      weakness.severity - policy.weakness.recoverySeverityDecay,
    );
    if (severity <= policy.weakness.resolveSeverityThreshold) {
      resolvedIds.push(weakness.id);
      reasons.push({
        code: "WEAKNESS_RESOLVED",
        message: `Resolved ${weakness.type} after sustained independent success`,
        evidenceIds: recentIndependent.map((item) => item.id),
        metadata: { weaknessId: weakness.id, type: weakness.type },
      });
      return { ...weakness, severity, resolvedAt: now };
    }

    reasons.push({
      code: "WEAKNESS_SEVERITY_DECAY",
      message: `Reduced ${weakness.type} severity after independent success`,
      evidenceIds: [evidence.id],
      metadata: { weaknessId: weakness.id, severity },
    });
    return { ...weakness, severity };
  });

  return { weaknesses: next, resolvedIds, reasons };
}

function collectDrafts(
  history: readonly LearningEvidence[],
  evidence: LearningEvidence,
  policy: LearningPolicy,
): WeaknessDraft[] {
  const drafts: WeaknessDraft[] = [];
  const skillHistory = skillEvidence(history, evidence.skill);

  const recentSkill = skillHistory.slice(-policy.weakness.repeatedErrorWindow);
  const recentFailures = recentSkill.filter(isFailure);
  if (
    recentSkill.length >= policy.weakness.repeatedErrorMinFailures &&
    recentFailures.length >= policy.weakness.repeatedErrorMinFailures
  ) {
    drafts.push({
      type: weaknessTypeForSkill(evidence.skill),
      skill: evidence.skill,
      reasonCode: "REPEATED_ERROR",
      message: `Repeated errors on ${evidence.skill}`,
      metadata: {
        window: policy.weakness.repeatedErrorWindow,
        failures: recentFailures.length,
      },
    });
  }

  const hintWindow = skillHistory.slice(-policy.weakness.hintDependencyWindow);
  const assisted = hintWindow.filter(isAssistedCorrect);
  if (assisted.length >= policy.weakness.hintDependencyMinAssisted) {
    drafts.push({
      type: WeaknessType.HINT_DEPENDENCY,
      skill: evidence.skill,
      reasonCode: "HINT_DEPENDENCY",
      message: `Hint-dependent answers on ${evidence.skill}`,
      metadata: { assistedCount: assisted.length },
    });
  }

  if (
    evidence.selectedWordId &&
    evidence.selectedWordId !== evidence.wordId &&
    (evidence.outcome === EvidenceOutcome.INCORRECT ||
      evidence.errorType === "CONFUSED_WITH_WORD")
  ) {
    const confusedCount = history.filter(
      (item) =>
        item.selectedWordId === evidence.selectedWordId &&
        item.selectedWordId !== item.wordId &&
        (isFailure(item) || item.errorType === "CONFUSED_WITH_WORD"),
    ).length;
    if (confusedCount >= policy.weakness.confusionMinCount) {
      drafts.push({
        type: WeaknessType.CONFUSION,
        skill: evidence.skill,
        relatedWordId: evidence.selectedWordId,
        reasonCode: "CONFUSION",
        message: `Repeatedly confused with another word`,
        metadata: {
          relatedWordId: evidence.selectedWordId,
          count: confusedCount,
        },
      });
    }
  }

  const spellingWindow = skillHistory.slice(
    -policy.weakness.spellingErrorWindow,
  );
  const spellingErrors = spellingWindow.filter((item) =>
    isSpellingErrorType(item.errorType),
  );
  if (
    isSpellingErrorType(evidence.errorType) ||
    spellingErrors.length >= policy.weakness.spellingErrorMinCount
  ) {
    drafts.push({
      type: WeaknessType.SPELLING,
      skill: evidence.skill,
      reasonCode: "SPELLING_ERRORS",
      message: isSpellingErrorType(evidence.errorType)
        ? "Spelling error recorded on this attempt"
        : "Repeated spelling errors",
      metadata: { count: Math.max(spellingErrors.length, 1) },
    });
  }

  if (
    evidence.responseTimeMs !== null &&
    !isSkipped(evidence)
  ) {
    const baselineSamples = skillHistory
      .filter(
        (item) =>
          item.id !== evidence.id &&
          item.responseTimeMs !== null &&
          !isSkipped(item) &&
          !isFailure(item),
      )
      .map((item) => item.responseTimeMs)
      .filter((value): value is number => value !== null);
    const baseline =
      baselineSamples.length >= policy.weakness.slowResponseMinBaselineSamples
        ? median(baselineSamples)
        : policy.weakness.slowResponseFallbackMs;
    if (
      baseline !== null &&
      evidence.responseTimeMs >
        baseline * (baselineSamples.length >=
        policy.weakness.slowResponseMinBaselineSamples
          ? policy.weakness.slowResponseRelativeMultiplier
          : 1)
    ) {
      drafts.push({
        type: WeaknessType.SLOW_RESPONSE,
        skill: evidence.skill,
        reasonCode: "SLOW_RESPONSE",
        message: "Response time exceeded the current baseline",
        metadata: {
          responseTimeMs: evidence.responseTimeMs,
          baselineMs: baseline,
        },
      });
    }
  }

  const instabilityWindow = history.slice(-policy.weakness.instabilityWindow);
  const alternations = countAlternations(instabilityWindow);
  if (alternations >= policy.weakness.instabilityMinAlternations) {
    drafts.push({
      type: WeaknessType.LONG_TERM_INSTABILITY,
      skill: evidence.skill,
      reasonCode: "LONG_TERM_INSTABILITY",
      message: "Performance is alternating between success and failure",
      metadata: { alternations },
    });
  }

  return drafts;
}

export function detectWeaknesses(
  input: DetectWeaknessesInput,
): DetectWeaknessesResult {
  const recovered = recoverWeaknesses(
    input.currentWeaknesses,
    input.history,
    input.evidence,
    input.policy,
    input.now,
  );

  let weaknesses = recovered.weaknesses;
  const added: Weakness[] = [];
  const reasons = [...recovered.reasons];

  for (const draft of collectDrafts(
    input.history,
    input.evidence,
    input.policy,
  )) {
    const result = upsertWeakness(
      weaknesses,
      draft,
      input.evidence,
      input.now,
      input.policy,
      input.createId,
    );
    weaknesses = result.weaknesses;
    if (result.added) {
      added.push(result.added);
      reasons.push({
        code: result.added.reason.code,
        message: result.added.reason.message ?? `Detected ${result.added.type}`,
        evidenceIds: result.added.reason.evidenceIds,
        metadata: {
          weaknessId: result.added.id,
          type: result.added.type,
          relatedWordId: result.added.relatedWordId,
        },
      });
    } else if (result.updated) {
      reasons.push({
        code: `${draft.reasonCode}_RETRIGGERED`,
        message: `Updated existing ${draft.type} weakness`,
        evidenceIds: [input.evidence.id],
        metadata: {
          type: draft.type,
          relatedWordId: draft.relatedWordId,
        },
      });
    }
  }

  return {
    weaknesses,
    added,
    resolvedIds: recovered.resolvedIds,
    reasons,
  };
}
