import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "@/contextual-learning/candidate-v0/memory-routing/bundled-lexeme-bindings";
import { MEAL_SCENE_CONTENT_PACK } from "@/contextual-learning/candidate-v0/content/packs/meal/meal-scene-content";
import type { ContextualSceneContentPack } from "@/contextual-learning/candidate-v0/content/types";
import type { SceneLexemeLoader } from "@/contextual-learning/candidate-v0/content/types";

export const MEAL_TEST_VOCAB: Record<
  string,
  { id: string; display: string; lemma: string; meaningsZh: string[]; ipa: string[] }
> = {
  "lex-1300-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.soup),
    display: "soup",
    lemma: "soup",
    meaningsZh: ["汤"],
    ipa: ["/suːp/"],
  },
  "lex-0179-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.bowl),
    display: "bowl",
    lemma: "bowl",
    meaningsZh: ["碗"],
    ipa: [],
  },
  "lex-1311-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.spoon),
    display: "spoon",
    lemma: "spoon",
    meaningsZh: ["匙，调羹"],
    ipa: ["/spuːn/"],
  },
  "lex-0548-1": {
    id: bundledBindingLexemeId(BUNDLED_LEXEME_BINDINGS.fork),
    display: "fork",
    lemma: "fork",
    meaningsZh: ["叉，餐叉"],
    ipa: ["/fɔːk/"],
  },
};

export const mealTestLexemeLoader: SceneLexemeLoader = (canonicalKey) =>
  MEAL_TEST_VOCAB[canonicalKey] ?? null;

export function cloneMealPack(): ContextualSceneContentPack {
  return structuredClone(MEAL_SCENE_CONTENT_PACK);
}
