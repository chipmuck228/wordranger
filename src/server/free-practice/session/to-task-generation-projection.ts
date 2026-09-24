import "server-only";

import type { LearningNeed } from "@/domain/learning/learning-need";
import type { FreePracticeItem } from "@/server/free-practice/planning/types";

/**
 * Local TaskGenerator compatibility projection.
 * Routing tokens only — not a current pedagogical LearningNeed,
 * not Scheduler provenance, and not for persistence or public DTO.
 * Import only from the Free Practice session controller.
 */
export function toTaskGenerationProjection(
  item: FreePracticeItem,
): LearningNeed {
  return {
    id: item.id,
    lexemeId: item.lexemeId,
    targetSkill: item.targetSkill,
    priority: 0,
    reason: item.source === "UNSEEN" ? "NEW_WORD" : "STAGE_PROGRESS",
    preferredPromptModes: [],
    avoidRecentTaskTypes: [],
  };
}
