import { GameSessionError } from "@/server/game-session/ranger-trial-errors";
import { DAILY_TRAINING_ORCHESTRATION_TYPE } from "@/server/auth/v1-user";
import type {
  DailyTrainingSessionRecord,
  DailyTrainingSessionStore,
} from "./daily-training.types";

interface StoredTrainingSession {
  gameType: string;
  record: DailyTrainingSessionRecord;
}

export type InMemoryDailyTrainingSessionMap = Map<string, StoredTrainingSession>;

function conflict(): never {
  throw new GameSessionError(
    "SESSION_CONFLICT",
    "Session was updated by another request",
  );
}

export class InMemoryDailyTrainingSessionStore
  implements DailyTrainingSessionStore
{
  constructor(
    private readonly sessions: InMemoryDailyTrainingSessionMap = new Map(),
  ) {}

  async create(
    record: DailyTrainingSessionRecord,
  ): Promise<DailyTrainingSessionRecord> {
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
    this.sessions.set(record.sessionId, {
      gameType: DAILY_TRAINING_ORCHESTRATION_TYPE,
      record: stored,
    });
    return structuredClone(stored);
  }

  async save(
    record: DailyTrainingSessionRecord,
  ): Promise<DailyTrainingSessionRecord> {
    const stored = this.sessions.get(record.sessionId);
    if (
      !stored ||
      stored.gameType !== DAILY_TRAINING_ORCHESTRATION_TYPE ||
      stored.record.revision !== record.revision
    ) {
      conflict();
    }
    const next = structuredClone(record);
    next.revision = record.revision + 1;
    this.sessions.set(record.sessionId, {
      gameType: DAILY_TRAINING_ORCHESTRATION_TYPE,
      record: next,
    });
    return structuredClone(next);
  }

  async get(sessionId: string): Promise<DailyTrainingSessionRecord | null> {
    const stored = this.sessions.get(sessionId);
    if (!stored) {
      return null;
    }
    if (stored.gameType !== DAILY_TRAINING_ORCHESTRATION_TYPE) {
      throw new GameSessionError(
        "SESSION_NOT_FOUND",
        "Session is not a Daily Training round",
      );
    }
    return structuredClone(stored.record);
  }
}
