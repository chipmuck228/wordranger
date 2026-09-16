import type { LearningNeed } from "@/domain/learning/learning-need";
import type { LearningGameDefinition } from "./game-definition";
import type { GameSessionGenerationFailure } from "./learning-game-session.types";
import { GameSessionError } from "./ranger-trial-errors";

/**
 * Application-side compatibility filter. Scheduler remains game-agnostic.
 * Retained needs keep their original relative order.
 */
export function filterPlayableNeeds(
  needs: LearningNeed[],
  definition: LearningGameDefinition,
): {
  playable: LearningNeed[];
  excluded: GameSessionGenerationFailure[];
} {
  const playable: LearningNeed[] = [];
  const excluded: GameSessionGenerationFailure[] = [];
  for (const need of needs) {
    if (definition.capability.supportedSkills.includes(need.targetSkill)) {
      playable.push(need);
    } else {
      excluded.push({
        needId: need.id,
        lexemeId: need.lexemeId,
        skill: need.targetSkill,
        code: "GAME_CAPABILITY_UNSUPPORTED",
        reason: "GAME_CAPABILITY_UNSUPPORTED",
      });
    }
  }
  return { playable, excluded };
}

export function playableNeedsFromPlan(
  needs: LearningNeed[],
  definition: LearningGameDefinition,
): {
  playable: LearningNeed[];
  excluded: GameSessionGenerationFailure[];
} {
  if (needs.length === 0) {
    throw new GameSessionError(
      "NO_LEARNING_NEEDS",
      "Scheduler returned no usable learning needs",
    );
  }
  const filtered = filterPlayableNeeds(needs, definition);
  if (filtered.playable.length === 0) {
    throw new GameSessionError(
      "NO_PLAYABLE_NEEDS",
      "Scheduler needs were incompatible with this game",
      { excluded: filtered.excluded },
    );
  }
  return filtered;
}
