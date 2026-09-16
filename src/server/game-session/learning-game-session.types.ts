import type { LearningNeed } from "@/domain/learning/learning-need";
import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type { RecentTaskSummary } from "@/domain/tasks/task-generation-request";

export type GameSubmissionStatus =
  | "CORRECT"
  | "ASSISTED"
  | "INCORRECT"
  | "SKIPPED"
  | "TIMEOUT";

export interface GameSubmissionFeedback {
  status: GameSubmissionStatus;
  message: string;
  continueAvailable: boolean;
  correction?: {
    text: string;
  };
}

export type GameSessionPhase =
  | "awaiting_action"
  | "awaiting_continue"
  | "completed"
  | "failed";

export interface GameSessionStats {
  attempted: number;
  correct: number;
  incorrect: number;
}

export interface GameSessionGenerationFailure {
  needId: string;
  lexemeId: string;
  skill: string;
  code: string;
  reason: string;
}

export interface GameSessionRecord {
  sessionId: string;
  userId: string;
  planId: string;
  createdAt: string;
  needs: LearningNeed[];
  currentNeedIndex: number;
  currentTaskId: string | null;
  phase: GameSessionPhase;
  completed: number;
  stats: GameSessionStats;
  lastFeedback: GameSubmissionFeedback | null;
  lastCompletedTaskId: string | null;
  generationFailures: GameSessionGenerationFailure[];
  recentTasks: RecentTaskSummary[];
  /**
   * Persistence CAS token. Not learning state and not stateVersion.
   * New sessions start at 0; each successful update increments by 1.
   */
  revision: number;
}

export interface GamePublicSession {
  sessionId: string;
  planId: string;
  current: number;
  total: number;
  completed: number;
  currentTaskId: string | null;
}

export type StudentActionIntent =
  | { kind: "CHOICE"; optionId: string }
  | { kind: "TEXT_INPUT"; value: string };

export interface StartGameSessionResult {
  session: GamePublicSession;
  task: PublicLearningTask;
}

export interface SubmitGameSessionResult {
  feedback: GameSubmissionFeedback;
  progress: GamePublicSession;
  stats: GameSessionStats;
}

export interface ContinueGameSessionResult {
  completed: boolean;
  progress: GamePublicSession;
  stats: GameSessionStats;
  task?: PublicLearningTask;
}

export interface ResumeGameSessionResult {
  completed: boolean;
  progress: GamePublicSession;
  stats: GameSessionStats;
  task?: PublicLearningTask;
  feedback?: GameSubmissionFeedback;
}

export interface GameSessionStore {
  create(record: GameSessionRecord): Promise<GameSessionRecord>;
  get(sessionId: string): Promise<GameSessionRecord | null>;
  save(record: GameSessionRecord): Promise<GameSessionRecord>;
}

export type RangerTrialSessionPhase = GameSessionPhase;
export type RangerTrialSessionProgress = GamePublicSession;
export type RangerTrialSessionStats = GameSessionStats;
export type RangerTrialGenerationFailure = GameSessionGenerationFailure;
export type RangerTrialSessionRecord = GameSessionRecord;
export type RangerTrialPublicSession = GamePublicSession;
export type StartRangerTrialResult = StartGameSessionResult;
export type SubmitRangerTrialResult = SubmitGameSessionResult;
export type ContinueRangerTrialResult = ContinueGameSessionResult;
export type ResumeRangerTrialResult = ResumeGameSessionResult;
export type RangerTrialSessionStore = GameSessionStore;
