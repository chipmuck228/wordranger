import { GameSessionError } from "./ranger-trial-errors";
import type {
  GameSessionRecord,
  GameSessionStore,
} from "./learning-game-session.types";

export interface StoredGameSession {
  gameType: string;
  record: GameSessionRecord;
}

export type InMemoryGameSessionMap = Map<string, StoredGameSession>;

function conflict(): never {
  throw new GameSessionError(
    "SESSION_CONFLICT",
    "Session was updated by another request",
  );
}

export class InMemoryGameSessionStore implements GameSessionStore {
  constructor(
    private readonly expectedGameType: string,
    private readonly sessions: InMemoryGameSessionMap = new Map(),
  ) {}

  async create(record: GameSessionRecord): Promise<GameSessionRecord> {
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
      gameType: this.expectedGameType,
      record: stored,
    });
    return structuredClone(stored);
  }

  async save(record: GameSessionRecord): Promise<GameSessionRecord> {
    const stored = this.sessions.get(record.sessionId);
    if (
      !stored ||
      stored.gameType !== this.expectedGameType ||
      stored.record.revision !== record.revision
    ) {
      conflict();
    }
    const next = structuredClone(record);
    next.revision = record.revision + 1;
    this.sessions.set(record.sessionId, {
      gameType: this.expectedGameType,
      record: next,
    });
    return structuredClone(next);
  }

  async get(sessionId: string): Promise<GameSessionRecord | null> {
    const stored = this.sessions.get(sessionId);
    if (!stored) {
      return null;
    }
    if (stored.gameType !== this.expectedGameType) {
      throw new GameSessionError(
        "SESSION_NOT_FOUND",
        "Session game type does not match this game",
      );
    }
    return structuredClone(stored.record);
  }

  reset(): void {
    this.sessions.clear();
  }
}
