import "server-only";

import type { ContextualProbeTarget } from "@/contextual-learning/candidate-v0/probe/types";
import { MEAL_SCENE_CLUSTER } from "@/contextual-learning/candidate-v0/memory-routing/scene-catalog";
import {
  HOME_BREAKFAST_SCENE_ENTITY_IDS,
  mappedMealEntity,
} from "./meal-presentation-map";

const ENTITY_TO_FIXTURE: Record<
  (typeof HOME_BREAKFAST_SCENE_ENTITY_IDS)[number],
  string
> = {
  "home-soup": "lex-soup",
  "home-bowl": "lex-bowl",
  "home-spoon": "lex-spoon",
  "home-fork": "lex-fork",
};

export function mealColdProbeTargets(): ContextualProbeTarget[] {
  return HOME_BREAKFAST_SCENE_ENTITY_IDS.map((entityId) => {
    const fixtureId = ENTITY_TO_FIXTURE[entityId];
    const member = MEAL_SCENE_CLUSTER.members.find(
      (item) => item.candidateFixtureLexemeId === fixtureId,
    );
    const entity = mappedMealEntity(entityId);
    if (!member || !entity) {
      throw new Error(`Meal probe target ${entityId} is missing from the scene catalog`);
    }
    return {
      target: member.target,
      sceneClusterId: MEAL_SCENE_CLUSTER.id,
      roleId: member.roleId,
      entityId,
      displayLabel: entity.label,
      probeSkills: ["MEANING_RECOGNITION", "ACTIVE_RECALL"],
    };
  });
}
