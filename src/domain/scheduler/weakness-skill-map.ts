import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import { WeaknessType, type Weakness } from "@/domain/learning/weakness.types";

const DIRECT_SKILL: Partial<Record<WeaknessType, VocabularySkill>> = {
  [WeaknessType.MEANING]: VocabularySkill.MEANING_RECOGNITION,
  [WeaknessType.LISTENING]: VocabularySkill.LISTENING_RECOGNITION,
  [WeaknessType.SPELLING]: VocabularySkill.SPELLING_RECALL,
  [WeaknessType.ACTIVE_RECALL]: VocabularySkill.ACTIVE_RECALL,
  [WeaknessType.CONTEXT]: VocabularySkill.CONTEXT_USE,
  [WeaknessType.SEMANTIC_RELATION]: VocabularySkill.SEMANTIC_CONNECTION,
};

export function targetSkillForWeakness(weakness: Weakness): VocabularySkill | null {
  if (weakness.type === WeaknessType.USER_MARKED) {
    return null;
  }
  const mapped = DIRECT_SKILL[weakness.type];
  if (mapped) {
    return mapped;
  }
  if (
    weakness.type === WeaknessType.CONFUSION ||
    weakness.type === WeaknessType.HINT_DEPENDENCY ||
    weakness.type === WeaknessType.SLOW_RESPONSE ||
    weakness.type === WeaknessType.LONG_TERM_INSTABILITY
  ) {
    return weakness.skill ?? VocabularySkill.MEANING_RECOGNITION;
  }
  return weakness.skill ?? null;
}
