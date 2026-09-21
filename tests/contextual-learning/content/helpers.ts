import { bundledSceneLexemeLoader } from "@/server/runtime/bundled-scene-lexeme-loader";
import {
  HOME_BREAKFAST_FRAME_ID,
  MEAL_SCENE_CONTENT_PACK,
} from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import type {
  ContextualFactRef,
  ContextualSceneContentPack,
  ContextualSceneLexemeContent,
} from "@/contextual-learning/candidate-v0/content/types";
import type { SceneLexemeLoader } from "@/contextual-learning/candidate-v0/content/types";

export const mealTestLexemeLoader: SceneLexemeLoader = bundledSceneLexemeLoader;

export function cloneMealPack(): ContextualSceneContentPack {
  return structuredClone(MEAL_SCENE_CONTENT_PACK);
}

export function replaceFrameFacts(
  lexeme: ContextualSceneLexemeContent,
  facts: ContextualFactRef[],
  frameId = HOME_BREAKFAST_FRAME_ID,
): void {
  const others = lexeme.grounding.frameFacts.filter((item) => item.frameId !== frameId);
  lexeme.grounding = {
    ...lexeme.grounding,
    frameFacts: [{ frameId, facts }, ...others],
  };
}
