import type { PromptMode } from "@/domain/learning/evidence.types";
import type {
  LearningNeedReason,
  LearningNeedWeaknessFocus,
} from "@/domain/learning/learning-need";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";

export interface LearningNeedCandidate {
  id: string;
  lexemeId: string;
  targetSkill: VocabularySkill;
  reason: LearningNeedReason;
  basePriority: number;
  weaknessFocus?: LearningNeedWeaknessFocus;
  preferredPromptModes: PromptMode[];
  source: {
    ruleId: string;
    explanation: string;
  };
  metadata?: Record<string, unknown>;
}

export interface UserMarkedLexeme {
  lexemeId: string;
  markedAt: string;
  preferredSkill?: VocabularySkill;
}

export interface RecentLearningActivity {
  lexemeId: string;
  skill: VocabularySkill;
  taskType: string;
  occurredAt: string;
}

export interface SchedulerLexemeRef {
  id: string;
  sourceIndex: number;
  canonicalKey: string;
}
