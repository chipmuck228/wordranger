import "server-only";

import type { PublicLearningTask } from "@/domain/tasks/public-learning-task";
import type {
  FreePracticeItem,
  FreePracticeRequestedCount,
  FreePracticeSource,
} from "@/server/free-practice/planning/types";

export type FreePracticeSessionStatus = "active";

export interface FreePracticeSessionState {
  schemaVersion: "fp-session-v1";
  source: FreePracticeSource;
  requestedCount: FreePracticeRequestedCount;
  plannedCount: number;
  items: FreePracticeItem[];
  currentIndex: number;
  assignedItemId: string | null;
  currentTaskId: string | null;
  status: FreePracticeSessionStatus;
  createdAt: string;
}

export interface FreePracticeSessionRecord {
  sessionId: string;
  userId: string;
  planId: string;
  revision: number;
  state: FreePracticeSessionState;
}

export interface FreePracticeSessionStore {
  create(record: FreePracticeSessionRecord): Promise<FreePracticeSessionRecord>;
  get(
    sessionId: string,
    userId: string,
  ): Promise<FreePracticeSessionRecord | null>;
  save(record: FreePracticeSessionRecord): Promise<FreePracticeSessionRecord>;
}

export interface FreePracticePublicSession {
  sessionId: string;
  revision: number;
  source: FreePracticeSource;
  requestedCount: number;
  plannedCount: number;
  current: number;
  currentTaskId: string | null;
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
