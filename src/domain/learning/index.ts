export { MasteryStage, MASTERY_STAGE_ORDER } from "./mastery-stage";
export { RetentionState } from "./retention-state";
export { VocabularySkill, VOCABULARY_SKILLS } from "./vocabulary-skill";
export { WeaknessType, type Weakness, type WeaknessReason } from "./weakness.types";
export {
  EvidenceOutcome,
  PromptMode,
  AnswerMode,
  EvidenceErrorType,
  type LearningEvidence,
  type RecentPerformanceItem,
} from "./evidence.types";
export {
  createInitialStudentLexemeModel,
  createInitialSkillState,
  type StudentLexemeModel,
  type SkillState,
} from "./student-lexeme-model";
export type { GameCapability } from "./game-capability";
export type { LearningNeed, LearningNeedReason, LearningNeedWeaknessFocus } from "./learning-need";
export type { TransitionReason, TransitionResult } from "./transition.types";
export type { LearningPolicy } from "./policies/learning-policy";
export { DEFAULT_LEARNING_POLICY } from "./policies/default-learning-policy";
export { processEvidence } from "./engine/process-evidence";
export type {
  ProcessEvidenceInput,
  ProcessEvidenceResult,
} from "./engine/process-evidence";
export type { LearningRepository } from "./learning-repository";
