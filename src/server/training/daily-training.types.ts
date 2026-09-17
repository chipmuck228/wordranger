import type { LearningNeed } from "@/domain/learning/learning-need";
import type { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { RecentTaskSummary } from "@/domain/tasks/task-generation-request";
import type {
  GamePublicSession,
  GameSessionGenerationFailure,
  GameSessionPhase,
  GameSessionStats,
  GameSubmissionFeedback,
  StudentActionIntent,
} from "@/server/game-session/learning-game-session.types";

export type DailyTrainingItemStatus =
  | "PLANNED"
  | "READY"
  | "COMPLETED"
  | "SKIPPED";

export interface DailyTrainingItem {
  needId: string;
  lexemeId: string;
  targetSkill: VocabularySkill;
  taskId: string | null;
  rendererGameType: string | null;
  status: DailyTrainingItemStatus;
}

export interface DailyTrainingSessionRecord {
  sessionId: string;
  userId: string;
  planId: string;
  createdAt: string;
  needs: LearningNeed[];
  items: DailyTrainingItem[];
  currentNeedIndex: number;
  currentTaskId: string | null;
  phase: GameSessionPhase;
  completed: number;
  stats: GameSessionStats;
  lastFeedback: GameSubmissionFeedback | null;
  lastCompletedTaskId: string | null;
  generationFailures: GameSessionGenerationFailure[];
  recentTasks: RecentTaskSummary[];
  recentRendererTypes: string[];
  attentionLexemeIds: string[];
  revision: number;
}

export interface DailyTrainingPublicSession extends GamePublicSession {
  rendererGameType: string | null;
}

export interface StartDailyTrainingResult {
  session: DailyTrainingPublicSession;
  task: PublicLearningTask;
  rendererGameType: string;
}

export interface SubmitDailyTrainingResult {
  feedback: GameSubmissionFeedback;
  progress: DailyTrainingPublicSession;
  stats: GameSessionStats;
}

export interface ContinueDailyTrainingResult {
  completed: boolean;
  progress: DailyTrainingPublicSession;
  stats: GameSessionStats;
  task?: PublicLearningTask;
  rendererGameType?: string;
  recapWords?: string[];
}

export interface ResumeDailyTrainingResult {
  completed: boolean;
  progress: DailyTrainingPublicSession;
  stats: GameSessionStats;
  task?: PublicLearningTask;
  rendererGameType?: string;
  feedback?: GameSubmissionFeedback;
  recapWords?: string[];
}

export interface DailyTrainingSessionStore {
  create(record: DailyTrainingSessionRecord): Promise<DailyTrainingSessionRecord>;
  get(sessionId: string): Promise<DailyTrainingSessionRecord | null>;
  save(record: DailyTrainingSessionRecord): Promise<DailyTrainingSessionRecord>;
}

export type { StudentActionIntent };
