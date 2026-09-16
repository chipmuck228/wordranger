import { GameSessionError } from "./ranger-trial-errors";
import type {
  RangerTrialSessionRecord,
  RangerTrialSessionStore,
} from "./ranger-trial-session.types";

function conflict(): never {
  throw new GameSessionError(
    "SESSION_CONFLICT",
    "Session was updated by another request",
  );
}

export class InMemoryRangerTrialSessionStore
  implements RangerTrialSessionStore
{
  private readonly sessions = new Map<string, RangerTrialSessionRecord>();

  async create(
    record: RangerTrialSessionRecord,
  ): Promise<RangerTrialSessionRecord> {
    if (record.revision !== 0) {
      throw new GameSessionError(
        "SESSION_START_FAILED",
        "New sessions must start at revision 0",
      );
    }
    if (this.sessions.has(record.sessionId)) {
      conflict();
    }
    const stored = structuredClone(record);
    stored.revision = 0;
    this.sessions.set(record.sessionId, stored);
    return structuredClone(stored);
  }

  async save(
    record: RangerTrialSessionRecord,
  ): Promise<RangerTrialSessionRecord> {
    const stored = this.sessions.get(record.sessionId);
    if (!stored || stored.revision !== record.revision) {
      conflict();
    }
    const next = structuredClone(record);
    next.revision = record.revision + 1;
    this.sessions.set(record.sessionId, next);
    return structuredClone(next);
  }

  async get(sessionId: string): Promise<RangerTrialSessionRecord | null> {
    const record = this.sessions.get(sessionId);
    return record ? structuredClone(record) : null;
  }

  reset(): void {
    this.sessions.clear();
  }
}
