import type { LearningTaskType } from "./task-type";

export interface TaskGenerationTrace {
  generatorVersion: string;
  archetype: LearningTaskType;
  targetLexemeId: string;
  candidateLexemeIds: string[];
  selectedDistractorLexemeIds: string[];
  relationIds: string[];
  blockedCandidates: Array<{
    lexemeId?: string;
    relationId?: string;
    reason: string;
  }>;
  policyVersion: string;
  randomSeed?: string;
}
