import { MATCHING_GAME_DEFINITION } from "./matching-capability";
import {
  LearningGameSessionController,
  type LearningGameSessionDeps,
  type RangerTrialSessionDeps,
} from "./learning-game-session-controller";

export type MatchingSessionDeps = RangerTrialSessionDeps;

/**
 * Matching adapter: same generic orchestration, CHOICE-only definition.
 */
export class MatchingSessionController extends LearningGameSessionController {
  constructor(deps: MatchingSessionDeps) {
    super({
      ...deps,
      definition: MATCHING_GAME_DEFINITION,
    } satisfies LearningGameSessionDeps);
  }
}
