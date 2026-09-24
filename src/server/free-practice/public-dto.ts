import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";

export type FreePracticeSource = "UNSEEN" | "RECENTLY_INCORRECT";

export type FreePracticeRequestedCount = 5 | 10;

export type FreePracticeSessionPhase =
  | "AWAITING_ACTION"
  | "AWAITING_CONTINUE"
  | "COMPLETED";

export interface FreePracticePublicFeedback {
  taskId: string;
  correct: boolean;
  message: string;
}

export interface FreePracticePublicSession {
  sessionId: string;
  revision: number;
  source: FreePracticeSource;
  requestedCount: number;
  plannedCount: number;
  current: number;
  currentTaskId: string | null;
  phase: FreePracticeSessionPhase;
  attempted: number;
  correct: number;
  presentationGameType: "RANGER_TRIAL";
}

export type FreePracticeSessionPublicResult =
  | {
      status: "EMPTY";
      source: FreePracticeSource;
      requestedCount: number;
      reason: "NO_ELIGIBLE_WORDS";
    }
  | {
      status: "STARTED" | "RESUMED";
      session: FreePracticePublicSession;
      task: PublicLearningTask;
    }
  | {
      status: "AWAITING_CONTINUE";
      session: FreePracticePublicSession;
      task: PublicLearningTask;
      feedback: FreePracticePublicFeedback;
    }
  | {
      status: "COMPLETED";
      session: FreePracticePublicSession;
      completedAt: string;
      message: string;
    }
  | {
      status: "UNAVAILABLE";
      reason:
        | "NO_SERVER_SESSION"
        | "PLACEHOLDER_FORBIDDEN"
        | "AUTH_NOT_CONFIGURED"
        | "TASK_GENERATION_FAILED";
    }
  | {
      status: "NOT_FOUND";
    }
  | {
      status: "CONFLICT";
    }
  | {
      status: "INVALID";
      reason: "INVALID_REQUEST";
    };
