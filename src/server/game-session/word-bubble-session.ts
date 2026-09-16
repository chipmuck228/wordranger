import { WORD_BUBBLE_GAME_DEFINITION } from "./word-bubble-capability";
import {
  LearningGameSessionController,
  type LearningGameSessionDeps,
  type RangerTrialSessionDeps,
} from "./learning-game-session-controller";

export type WordBubbleSessionDeps = RangerTrialSessionDeps;

/**
 * Word Bubble adapter: same generic orchestration, CHOICE-only definition.
 */
export class WordBubbleSessionController extends LearningGameSessionController {
  constructor(deps: WordBubbleSessionDeps) {
    super({
      ...deps,
      definition: WORD_BUBBLE_GAME_DEFINITION,
    } satisfies LearningGameSessionDeps);
  }
}
