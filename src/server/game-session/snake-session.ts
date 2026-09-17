import { SNAKE_GAME_DEFINITION } from "./snake-capability";
import {
  LearningGameSessionController,
  type LearningGameSessionDeps,
  type RangerTrialSessionDeps,
} from "./learning-game-session-controller";

export type SnakeSessionDeps = RangerTrialSessionDeps;

/**
 * Snake adapter: same generic orchestration, CHOICE-only definition.
 */
export class SnakeSessionController extends LearningGameSessionController {
  constructor(deps: SnakeSessionDeps) {
    super({
      ...deps,
      definition: SNAKE_GAME_DEFINITION,
    } satisfies LearningGameSessionDeps);
  }
}
