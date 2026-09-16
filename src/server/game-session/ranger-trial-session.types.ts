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

export type RangerTrialSessionPhase =
  | "awaiting_action"
  | "awaiting_continue"
  | "completed"
  | "failed";

export interface RangerTrialSessionProgress {
  sessionId: string;
  planId: string;
  totalPlanned: number;
  completed: number;
  currentNeedIndex: number;
  currentTaskId: string | null;
}

export interface RangerTrialSessionStats {
  attempted: number;
  correct: number;
  incorrect: number;
}

export interface RangerTrialGenerationFailure {
  needId: string;
  lexemeId: string;
  skill: string;
  code: string;
  reason: string;
}

export interface RangerTrialSessionRecord {
  sessionId: string;
  userId: string;
  planId: string;
  createdAt: string;
  needs: LearningNeed[];
  currentNeedIndex: number;
  currentTaskId: string | null;
  phase: RangerTrialSessionPhase;
  completed: number;
  stats: RangerTrialSessionStats;
  lastFeedback: GameSubmissionFeedback | null;
  lastCompletedTaskId: string | null;
  generationFailures: RangerTrialGenerationFailure[];
  recentTasks: RecentTaskSummary[];
  /**
   * Persistence CAS token. Not learning state and not stateVersion.
   * New sessions start at 0; each successful update increments by 1.
   */
  revision: number;
}

export interface RangerTrialPublicSession {
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

export interface StartRangerTrialResult {
  session: RangerTrialPublicSession;
  task: PublicLearningTask;
}

export interface SubmitRangerTrialResult {
  feedback: GameSubmissionFeedback;
  progress: RangerTrialPublicSession;
  stats: RangerTrialSessionStats;
}

export interface ContinueRangerTrialResult {
  completed: boolean;
  progress: RangerTrialPublicSession;
  stats: RangerTrialSessionStats;
  task?: PublicLearningTask;
}

export interface ResumeRangerTrialResult {
  completed: boolean;
  progress: RangerTrialPublicSession;
  stats: RangerTrialSessionStats;
  task?: PublicLearningTask;
  feedback?: GameSubmissionFeedback;
}

export interface RangerTrialSessionStore {
  create(record: RangerTrialSessionRecord): Promise<RangerTrialSessionRecord>;
  get(sessionId: string): Promise<RangerTrialSessionRecord | null>;
  save(record: RangerTrialSessionRecord): Promise<RangerTrialSessionRecord>;
}
