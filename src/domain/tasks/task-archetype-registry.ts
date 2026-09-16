import { AnswerMode, PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType } from "@/domain/learning/weakness.types";
import type { TaskArchetype } from "./task-archetype";
import { LearningTaskType } from "./task-type";

const ALL_REASONS = [
  "NEW_WORD",
  "WEAKNESS",
  "REVIEW_DUE",
  "STAGE_PROGRESS",
  "FADING",
  "USER_MARKED",
] as const;

export const TASK_ARCHETYPES: readonly TaskArchetype[] = [
  {
    taskType: LearningTaskType.MEANING_CHOICE,
    targetSkills: [VocabularySkill.MEANING_RECOGNITION],
    promptMode: PromptMode.WORD_TO_MEANING,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    supportedNeedReasons: [...ALL_REASONS],
    supportedWeaknessTypes: [
      WeaknessType.MEANING,
      WeaknessType.CONFUSION,
      WeaknessType.HINT_DEPENDENCY,
    ],
    requiredContent: ["MEANING_ZH"],
  },
  {
    taskType: LearningTaskType.CONFUSABLE_CHOICE,
    targetSkills: [VocabularySkill.MEANING_RECOGNITION],
    promptMode: PromptMode.WORD_TO_MEANING,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    supportedNeedReasons: ["WEAKNESS"],
    supportedWeaknessTypes: [WeaknessType.CONFUSION],
    requiredContent: ["MEANING_ZH", "APPROVED_CONFUSABLE"],
  },
  {
    taskType: LearningTaskType.ACTIVE_RECALL_TYPING,
    targetSkills: [VocabularySkill.ACTIVE_RECALL],
    promptMode: PromptMode.MEANING_TO_WORD,
    answerMode: AnswerMode.TYPING,
    supportedNeedReasons: [...ALL_REASONS],
    supportedWeaknessTypes: [
      WeaknessType.ACTIVE_RECALL,
      WeaknessType.HINT_DEPENDENCY,
    ],
    requiredContent: ["MEANING_ZH"],
  },
  {
    taskType: LearningTaskType.SPELLING_RECALL_TYPING,
    targetSkills: [VocabularySkill.SPELLING_RECALL],
    promptMode: PromptMode.MEANING_TO_SPELLING,
    answerMode: AnswerMode.SPELLING,
    supportedNeedReasons: [...ALL_REASONS],
    supportedWeaknessTypes: [WeaknessType.SPELLING],
    requiredContent: ["MEANING_ZH"],
  },
  {
    taskType: LearningTaskType.RELATION_CHOICE,
    targetSkills: [VocabularySkill.SEMANTIC_CONNECTION],
    promptMode: PromptMode.WORD_TO_RELATION,
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    supportedNeedReasons: [...ALL_REASONS],
    supportedWeaknessTypes: [WeaknessType.SEMANTIC_RELATION],
    requiredContent: ["APPROVED_RELATION"],
  },
];

export function archetypesForSkill(skill: VocabularySkill): TaskArchetype[] {
  return TASK_ARCHETYPES.filter((archetype) =>
    archetype.targetSkills.includes(skill),
  );
}
