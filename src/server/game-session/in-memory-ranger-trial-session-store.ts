import { RANGER_TRIAL_GAME_TYPE } from "@/server/auth/v1-user";
import {
  InMemoryGameSessionStore,
  type InMemoryGameSessionMap,
} from "./in-memory-game-session-store";

export class InMemoryRangerTrialSessionStore extends InMemoryGameSessionStore {
  constructor(sessions?: InMemoryGameSessionMap) {
    super(RANGER_TRIAL_GAME_TYPE, sessions);
  }
}
