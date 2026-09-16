import type { VocabularySkill } from "./vocabulary-skill";

export enum WeaknessType {
  MEANING = "MEANING",
  LISTENING = "LISTENING",
  SPELLING = "SPELLING",
  ACTIVE_RECALL = "ACTIVE_RECALL",
  CONTEXT = "CONTEXT",
  SEMANTIC_RELATION = "SEMANTIC_RELATION",
  CONFUSION = "CONFUSION",
  SLOW_RESPONSE = "SLOW_RESPONSE",
  HINT_DEPENDENCY = "HINT_DEPENDENCY",
  LONG_TERM_INSTABILITY = "LONG_TERM_INSTABILITY",
  USER_MARKED = "USER_MARKED",
}

export interface WeaknessReason {
  code: string;
  evidenceIds: string[];
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface Weakness {
  id: string;
  type: WeaknessType;
  /**
   * 0 ~ 1
   */
  severity: number;
  skill?: VocabularySkill;
  relatedWordId?: string;
  reason: WeaknessReason;
  detectedAt: string;
  lastTriggeredAt: string;
  resolvedAt: string | null;
}
