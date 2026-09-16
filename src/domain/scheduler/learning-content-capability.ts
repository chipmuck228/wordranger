import { VocabularySkill } from "@/domain/learning/vocabulary-skill";

export interface LearningContentCapability {
  supportsSkill(skill: VocabularySkill): boolean;
}

const SUPPORTED = new Set<VocabularySkill>([
  VocabularySkill.MEANING_RECOGNITION,
  VocabularySkill.SEMANTIC_CONNECTION,
  VocabularySkill.ACTIVE_RECALL,
  VocabularySkill.SPELLING_RECALL,
]);

export class DefaultLearningContentCapability implements LearningContentCapability {
  supportsSkill(skill: VocabularySkill): boolean {
    return SUPPORTED.has(skill);
  }
}

export const DEFAULT_LEARNING_CONTENT_CAPABILITY =
  new DefaultLearningContentCapability();
