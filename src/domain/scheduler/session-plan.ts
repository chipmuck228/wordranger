import { PromptMode } from "@/domain/learning/evidence.types";
import type { LearningNeed } from "@/domain/learning/learning-need";
import type { SchedulerTrace } from "./scheduler-trace";

export interface LearningSessionPlan {
  id: string;
  userId: string;
  createdAt: string;
  schedulerPolicyVersion: string;
  requestedNeedCount: number;
  needs: LearningNeed[];
  trace: SchedulerTrace;
}

export function preferredPromptModesForSkill(
  skill: LearningNeed["targetSkill"],
): PromptMode[] {
  switch (skill) {
    case "MEANING_RECOGNITION":
      return [PromptMode.WORD_TO_MEANING];
    case "SEMANTIC_CONNECTION":
      return [PromptMode.WORD_TO_RELATION];
    case "ACTIVE_RECALL":
      return [PromptMode.MEANING_TO_WORD];
    case "SPELLING_RECALL":
      return [PromptMode.MEANING_TO_SPELLING];
    case "LISTENING_RECOGNITION":
      return [PromptMode.AUDIO_TO_WORD];
    case "CONTEXT_USE":
      return [PromptMode.CONTEXT_TO_WORD];
    default:
      return [];
  }
}
