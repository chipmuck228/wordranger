import "server-only";

import { FREE_PRACTICE_ORCHESTRATION_TYPE } from "./constants";
import { FreePracticeSessionError } from "./errors";
import { parseFreePracticeRecord, serializeFreePracticeState } from "./state";
import type {
  FreePracticeSessionRecord,
  FreePracticeSessionStore,
} from "./types";

export class InMemoryFreePracticeSessionStore
  implements FreePracticeSessionStore
{
  private readonly sessions = new Map<string, FreePracticeSessionRecord>();

  async create(
    record: FreePracticeSessionRecord,
  ): Promise<FreePracticeSessionRecord> {
    if (record.revision !== 0) {
      throw new FreePracticeSessionError(
        "SESSION_START_FAILED",
        "New sessions must start at revision 0",
      );
    }
    if (this.sessions.has(record.sessionId)) {
      throw new FreePracticeSessionError(
        "SESSION_CONFLICT",
        "Session was updated by another request",
      );
    }
    serializeFreePracticeState(record);
    const stored = structuredClone(record);
    stored.revision = 0;
    this.sessions.set(record.sessionId, stored);
    return structuredClone(stored);
  }

  async get(
    sessionId: string,
    userId: string,
  ): Promise<FreePracticeSessionRecord | null> {
    const stored = this.sessions.get(sessionId);
    if (!stored || stored.userId !== userId) {
      return null;
    }
    return parseFreePracticeRecord({
      sessionId: stored.sessionId,
      userId: stored.userId,
      gameType: FREE_PRACTICE_ORCHESTRATION_TYPE,
      expectedGameType: FREE_PRACTICE_ORCHESTRATION_TYPE,
      expectedUserId: userId,
      planId: stored.planId,
      state: structuredClone(stored.state),
      revision: stored.revision,
    });
  }

  async save(
    record: FreePracticeSessionRecord,
  ): Promise<FreePracticeSessionRecord> {
    serializeFreePracticeState(record);
    const stored = this.sessions.get(record.sessionId);
    if (
      !stored ||
      stored.userId !== record.userId ||
      stored.revision !== record.revision
    ) {
      throw new FreePracticeSessionError(
        "SESSION_CONFLICT",
        "Session was updated by another request",
      );
    }
    const next = structuredClone(record);
    next.revision = record.revision + 1;
    this.sessions.set(record.sessionId, next);
    return structuredClone(next);
  }

  count(): number {
    return this.sessions.size;
  }

  reset(): void {
    this.sessions.clear();
  }
}
