import { daysBetween } from "@/domain/learning/engine/time";
import type { StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import type { LearningNeedCandidate, RecentLearningActivity } from "./learning-need-candidate";
import { assemblePriority, type PriorityBreakdown } from "./priority-breakdown";
import type { SchedulerPolicy } from "./scheduler-policy";

export function scoreCandidate(
  candidate: LearningNeedCandidate,
  model: StudentLexemeModel | undefined,
  recent: RecentLearningActivity[],
  now: string,
  policy: SchedulerPolicy,
): PriorityBreakdown {
  const skillState = model?.skills[candidate.targetSkill];
  const window = [...recent]
    .sort(
      (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    )
    .slice(0, policy.recency.recentActivityWindow);
  const sameLexeme = window.some((item) => item.lexemeId === candidate.lexemeId);
  const sameSkillCount = window.filter(
    (item) => item.skill === candidate.targetSkill,
  ).length;
  let overdueBoost = 0;
  if (model?.nextReviewAt && Date.parse(model.nextReviewAt) <= Date.parse(now)) {
    const days = Math.max(0, daysBetween(model.nextReviewAt, now));
    const ratio = Math.min(1, days / policy.overdue.daysToMaxBoost);
    overdueBoost = ratio * policy.overdue.maxBoost;
  }
  const recencyPenalty =
    (sameLexeme ? policy.recency.sameLexemePenalty : 0) +
    (sameSkillCount >= 2 ? policy.recency.sameSkillPenalty : 0);
  return assemblePriority({
    reasonBase: policy.reasonWeights[candidate.reason],
    weaknessBoost:
      candidate.reason === "WEAKNESS" && candidate.weaknessFocus
        ? (typeof candidate.metadata?.severity === "number"
            ? candidate.metadata.severity
            : 0) * policy.weakness.severityWeight
        : 0,
    overdueBoost,
    fadingBoost: candidate.reason === "FADING" ? policy.fading.boost : 0,
    skillGapBoost: (1 - (skillState?.score ?? 0)) * policy.skillGap.scoreWeight,
    confidenceAdjustment:
      (1 - (skillState?.confidence ?? 0)) * policy.skillGap.confidenceWeight,
    recencyPenalty,
  });
}

export function avoidRecentTaskTypesForLexeme(
  lexemeId: string,
  recent: RecentLearningActivity[],
): string[] {
  const types: string[] = [];
  for (const item of recent) {
    if (item.lexemeId !== lexemeId) {
      continue;
    }
    if (!types.includes(item.taskType)) {
      types.push(item.taskType);
    }
  }
  return types;
}
