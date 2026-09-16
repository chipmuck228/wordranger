import { MasteryStage } from "@/domain/learning/mastery-stage";
import type { SkillState, StudentLexemeModel } from "@/domain/learning/student-lexeme-model";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { LearningContentCapability } from "./learning-content-capability";
import { DEFAULT_LEARNING_CONTENT_CAPABILITY } from "./learning-content-capability";

const PRODUCTION = [
  VocabularySkill.ACTIVE_RECALL,
  VocabularySkill.SPELLING_RECALL,
] as const;

const RECOGNITION_REVIEW = [
  VocabularySkill.MEANING_RECOGNITION,
  VocabularySkill.SEMANTIC_CONNECTION,
] as const;

const MEANINGFUL_REVIEW = [
  VocabularySkill.MEANING_RECOGNITION,
  VocabularySkill.SEMANTIC_CONNECTION,
  VocabularySkill.ACTIVE_RECALL,
  VocabularySkill.SPELLING_RECALL,
] as const;

export function weakerSkill(
  left: VocabularySkill,
  right: VocabularySkill,
  skills: StudentLexemeModel["skills"],
): VocabularySkill {
  const leftState = skills[left];
  const rightState = skills[right];
  if (leftState.score !== rightState.score) {
    return leftState.score < rightState.score ? left : right;
  }
  if (leftState.confidence !== rightState.confidence) {
    return leftState.confidence < rightState.confidence ? left : right;
  }
  return left < right ? left : right;
}

export function weakestPracticedSkill(
  skills: StudentLexemeModel["skills"],
  allowed: readonly VocabularySkill[],
): VocabularySkill | null {
  const practiced = allowed.filter((skill) => skills[skill].totalAttempts > 0);
  const pool = practiced.length > 0 ? practiced : [...allowed];
  if (pool.length === 0) {
    return null;
  }
  return pool.reduce((winner, skill) => weakerSkill(winner, skill, skills));
}

function firstSupported(
  skills: readonly VocabularySkill[],
  capability: LearningContentCapability,
): VocabularySkill | null {
  return skills.find((skill) => capability.supportsSkill(skill)) ?? null;
}

export function selectStageProgressSkill(
  model: StudentLexemeModel,
  capability: LearningContentCapability = DEFAULT_LEARNING_CONTENT_CAPABILITY,
): VocabularySkill | null {
  switch (model.masteryStage) {
    case MasteryStage.UNSEEN:
    case MasteryStage.EXPOSED:
      return VocabularySkill.MEANING_RECOGNITION;
    case MasteryStage.RECOGNIZED:
      return VocabularySkill.SEMANTIC_CONNECTION;
    case MasteryStage.CONNECTED:
    case MasteryStage.RECALLED:
      return weakerSkill(
        VocabularySkill.ACTIVE_RECALL,
        VocabularySkill.SPELLING_RECALL,
        model.skills,
      );
    case MasteryStage.USABLE:
      return VocabularySkill.CONTEXT_USE;
    case MasteryStage.MASTERED:
      return null;
    default:
      return firstSupported(MEANINGFUL_REVIEW, capability);
  }
}

export function selectReviewSkill(
  model: StudentLexemeModel,
  capability: LearningContentCapability = DEFAULT_LEARNING_CONTENT_CAPABILITY,
): VocabularySkill | null {
  switch (model.masteryStage) {
    case MasteryStage.UNSEEN:
    case MasteryStage.EXPOSED:
      return VocabularySkill.MEANING_RECOGNITION;
    case MasteryStage.RECOGNIZED:
      return weakerSkill(
        VocabularySkill.MEANING_RECOGNITION,
        VocabularySkill.SEMANTIC_CONNECTION,
        model.skills,
      );
    case MasteryStage.CONNECTED:
    case MasteryStage.RECALLED:
      return weakerSkill(
        VocabularySkill.ACTIVE_RECALL,
        VocabularySkill.SPELLING_RECALL,
        model.skills,
      );
    case MasteryStage.USABLE:
      if (capability.supportsSkill(VocabularySkill.CONTEXT_USE)) {
        return VocabularySkill.CONTEXT_USE;
      }
      return weakerSkill(
        VocabularySkill.ACTIVE_RECALL,
        VocabularySkill.SPELLING_RECALL,
        model.skills,
      );
    case MasteryStage.MASTERED:
      return weakestPracticedSkill(model.skills, MEANINGFUL_REVIEW);
    default:
      return VocabularySkill.MEANING_RECOGNITION;
  }
}

export function fallbackSkillForUnsupported(
  preferred: VocabularySkill,
  model: StudentLexemeModel,
): VocabularySkill | null {
  if (preferred === VocabularySkill.CONTEXT_USE) {
    return weakerSkill(
      VocabularySkill.ACTIVE_RECALL,
      VocabularySkill.SPELLING_RECALL,
      model.skills,
    );
  }
  if (preferred === VocabularySkill.LISTENING_RECOGNITION) {
    return null;
  }
  return null;
}

export function weakestUnresolvedWeaknessSkill(
  model: StudentLexemeModel,
  targetSkillForWeakness: (weakness: { skill?: VocabularySkill }) => VocabularySkill | null,
): VocabularySkill | null {
  const open = model.weaknesses.filter((weakness) => weakness.resolvedAt === null);
  if (open.length === 0) {
    return null;
  }
  const strongest = [...open].sort((left, right) => {
    if (right.severity !== left.severity) {
      return right.severity - left.severity;
    }
    return left.id.localeCompare(right.id);
  })[0];
  return targetSkillForWeakness(strongest);
}

export function selectFadingRecoverySkill(
  model: StudentLexemeModel,
  weaknessSkill: VocabularySkill | null,
): VocabularySkill {
  if (weaknessSkill) {
    return weaknessSkill;
  }
  const practiced = weakestPracticedSkill(model.skills, [
    ...RECOGNITION_REVIEW,
    ...PRODUCTION,
  ]);
  if (practiced) {
    return practiced;
  }
  return selectReviewSkill(model) ?? VocabularySkill.MEANING_RECOGNITION;
}

export type { SkillState };
