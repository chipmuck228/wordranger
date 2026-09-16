import type { LearningEvidence } from "@/domain/learning/evidence.types";
import type { RecentLearningActivity } from "@/domain/scheduler/learning-need-candidate";

export function recentActivityFromEvidence(
  items: readonly Pick<
    LearningEvidence,
    "lexemeId" | "skill" | "taskType" | "occurredAt"
  >[],
): RecentLearningActivity[] {
  return [...items]
    .sort(
      (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    )
    .map((item) => ({
      lexemeId: item.lexemeId,
      skill: item.skill,
      taskType: item.taskType,
      occurredAt: item.occurredAt,
    }));
}
