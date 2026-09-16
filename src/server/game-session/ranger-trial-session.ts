import { RANGER_TRIAL_GAME_DEFINITION } from "./ranger-trial-capability";
import {
  LearningGameSessionController,
  type LearningGameSessionDeps,
  type RangerTrialSessionDeps,
} from "./learning-game-session-controller";

export type { RangerTrialSessionDeps };

/**
 * Ranger Trial adapter: same generic orchestration, CHOICE + TEXT_INPUT definition.
 */
export class RangerTrialSessionController extends LearningGameSessionController {
  constructor(deps: RangerTrialSessionDeps) {
    super({
      ...deps,
      definition: RANGER_TRIAL_GAME_DEFINITION,
    } satisfies LearningGameSessionDeps);
  }
}
