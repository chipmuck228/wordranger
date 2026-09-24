import "server-only";

import type {
  FreePracticeItem,
  FreePracticeRequestedCount,
  FreePracticeSource,
} from "@/server/free-practice/planning/types";
import type {
  FreePracticePublicFeedback,
  FreePracticeSessionPhase,
} from "@/server/free-practice/public-dto";

export type {
  FreePracticePublicFeedback,
  FreePracticePublicSession,
  FreePracticeSessionPhase,
  FreePracticeSessionPublicResult,
} from "@/server/free-practice/public-dto";

export interface FreePracticeSessionState {
  schemaVersion: "fp-session-v2";
  source: FreePracticeSource;
  requestedCount: FreePracticeRequestedCount;
  plannedCount: number;
  items: FreePracticeItem[];
  currentIndex: number;
  assignedItemId: string | null;
  currentTaskId: string | null;
  phase: FreePracticeSessionPhase;
  attempted: number;
  correct: number;
  lastCompletedTaskId: string | null;
  feedback: FreePracticePublicFeedback | null;
  createdAt: string;
  completedAt: string | null;
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
