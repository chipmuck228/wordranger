import { MasteryStage } from "./mastery-stage";
import { RetentionState } from "./retention-state";
import {
  VOCABULARY_SKILLS,
  VocabularySkill,
} from "./vocabulary-skill";
import type { RecentPerformanceItem } from "./evidence.types";
import type { Weakness } from "./weakness.types";

export interface SkillState {
  skill: VocabularySkill;
  /**
   * 0 ~ 1
   */
  score: number;
  /**
   * 0 ~ 1
   */
  confidence: number;
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  assistedAttempts: number;
  lastPracticedAt: string | null;
  lastIndependentSuccessAt: string | null;
  consecutiveIndependentSuccesses: number;
  recentPerformance: RecentPerformanceItem[];
}

export interface StudentWordModel {
  id: string;
  userId: string;
  wordId: string;
  masteryStage: MasteryStage;
  retentionState: RetentionState;
  /**
   * 0 ~ 1
   */
  masteryScore: number;
  /**
   * 0 ~ 1
   */
  masteryConfidence: number;
  skills: Record<VocabularySkill, SkillState>;
  weaknesses: Weakness[];
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  nextReviewAt: string | null;
  reviewIntervalDays: number;
  evidenceCount: number;
  distinctPracticeDays: number;
  distinctTaskTypes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInitialStudentWordModelInput {
  id: string;
  userId: string;
  wordId: string;
  now: string;
}

export function createInitialSkillState(skill: VocabularySkill): SkillState {
  return {
    skill,
    score: 0,
    confidence: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    assistedAttempts: 0,
    lastPracticedAt: null,
    lastIndependentSuccessAt: null,
    consecutiveIndependentSuccesses: 0,
    recentPerformance: [],
  };
}

export function createInitialStudentWordModel(
  input: CreateInitialStudentWordModelInput,
): StudentWordModel {
  const skills = Object.fromEntries(
    VOCABULARY_SKILLS.map((skill) => [skill, createInitialSkillState(skill)]),
  ) as Record<VocabularySkill, SkillState>;

  return {
    id: input.id,
    userId: input.userId,
    wordId: input.wordId,
    masteryStage: MasteryStage.UNSEEN,
    retentionState: RetentionState.NEW,
    masteryScore: 0,
    masteryConfidence: 0,
    skills,
    weaknesses: [],
    firstSeenAt: null,
    lastSeenAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    nextReviewAt: null,
    reviewIntervalDays: 0,
    evidenceCount: 0,
    distinctPracticeDays: 0,
    distinctTaskTypes: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
}
