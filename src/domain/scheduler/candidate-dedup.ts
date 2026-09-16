import type { LearningNeed, LearningNeedReason } from "@/domain/learning/learning-need";
import type { LearningNeedCandidate } from "./learning-need-candidate";
import type { PriorityBreakdown } from "./priority-breakdown";
import { PRIMARY_REASON_PRECEDENCE } from "./scheduler-policy";
import { assemblePriority } from "./priority-breakdown";

export interface ScoredCandidate {
  candidate: LearningNeedCandidate;
  breakdown: PriorityBreakdown;
}

export interface DedupedNeed {
  need: LearningNeed;
  breakdown: PriorityBreakdown;
  sourceIds: string[];
  explanations: string[];
  sourceRuleIds: string[];
}

export function candidateKey(lexemeId: string, skill: string): string {
  return `${lexemeId}::${skill}`;
}

function primaryReason(reasons: LearningNeedReason[]): LearningNeedReason {
  for (const reason of PRIMARY_REASON_PRECEDENCE) {
    if (reasons.includes(reason)) {
      return reason;
    }
  }
  return reasons[0];
}

export function dedupeCandidates(scored: ScoredCandidate[]): {
  needs: DedupedNeed[];
  mergedInto: Map<string, string>;
} {
  const groups = new Map<string, ScoredCandidate[]>();
  for (const item of scored) {
    const key = candidateKey(item.candidate.lexemeId, item.candidate.targetSkill);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const mergedInto = new Map<string, string>();
  const needs: DedupedNeed[] = [];
  for (const group of groups.values()) {
    const reasons = [...new Set(group.map((item) => item.candidate.reason))];
    const reason = primaryReason(reasons);
    const supportingReasons = reasons.filter((item) => item !== reason);
    const winner =
      group.find((item) => item.candidate.reason === reason) ?? group[0];
    const weaknessCandidates = group
      .map((item) => item.candidate)
      .filter((item) => item.weaknessFocus && typeof item.metadata?.severity === "number")
      .sort((left, right) => {
        const delta =
          Number(right.metadata?.severity) - Number(left.metadata?.severity);
        if (delta !== 0) {
          return delta;
        }
        return left.id.localeCompare(right.id);
      });
    const promptModes = [
      ...new Set(group.flatMap((item) => item.candidate.preferredPromptModes)),
    ];
    const breakdown = assemblePriority({
      reasonBase: Math.max(...group.map((item) => item.breakdown.reasonBase)),
      weaknessBoost: Math.max(...group.map((item) => item.breakdown.weaknessBoost)),
      overdueBoost: Math.max(...group.map((item) => item.breakdown.overdueBoost)),
      fadingBoost: Math.max(...group.map((item) => item.breakdown.fadingBoost)),
      skillGapBoost: winner.breakdown.skillGapBoost,
      confidenceAdjustment: winner.breakdown.confidenceAdjustment,
      recencyPenalty: winner.breakdown.recencyPenalty,
    });
    const need: LearningNeed = {
      id: winner.candidate.id,
      lexemeId: winner.candidate.lexemeId,
      targetSkill: winner.candidate.targetSkill,
      priority: breakdown.finalPriority,
      reason,
      supportingReasons:
        supportingReasons.length > 0 ? supportingReasons : undefined,
      weaknessFocus: weaknessCandidates[0]?.weaknessFocus,
      preferredPromptModes: promptModes,
      avoidRecentTaskTypes: [],
    };
    for (const item of group) {
      if (item.candidate.id !== need.id) {
        mergedInto.set(item.candidate.id, need.id);
      }
    }
    needs.push({
      need,
      breakdown,
      sourceIds: group.map((item) => item.candidate.id),
      explanations: group.map((item) => item.candidate.source.explanation),
      sourceRuleIds: group.map((item) => item.candidate.source.ruleId),
    });
  }
  return { needs, mergedInto };
}
