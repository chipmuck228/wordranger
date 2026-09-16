import type {
  RangerTrialSessionRecord,
  RangerTrialSessionStore,
} from "./ranger-trial-session.types";

export class InMemoryRangerTrialSessionStore
  implements RangerTrialSessionStore
{
  private readonly sessions = new Map<string, RangerTrialSessionRecord>();

  async save(record: RangerTrialSessionRecord): Promise<void> {
    this.sessions.set(record.sessionId, structuredClone(record));
  }

  async get(sessionId: string): Promise<RangerTrialSessionRecord | null> {
    const record = this.sessions.get(sessionId);
    return record ? structuredClone(record) : null;
  }

  reset(): void {
    this.sessions.clear();
  }
}
