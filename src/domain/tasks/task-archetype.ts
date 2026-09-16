import type { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import type { LearningNeedReason } from "@/domain/learning/learning-need";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { WeaknessType } from "@/domain/learning/weakness.types";
import type { LearningTaskType } from "./task-type";

export type TaskContentRequirement =
  | "MEANING_ZH"
  | "APPROVED_RELATION"
  | "APPROVED_CONFUSABLE"
  | "APPROVED_AUDIO"
  | "APPROVED_CONTEXT";

export interface TaskArchetype {
  taskType: LearningTaskType;
  targetSkills: VocabularySkill[];
  promptMode: PromptMode;
  answerMode: AnswerMode;
  supportedNeedReasons: LearningNeedReason[];
  supportedWeaknessTypes: WeaknessType[];
  requiredContent: TaskContentRequirement[];
}
