/**
 * Meal Scene Content lexeme loader for resolveSceneContent.
 * Identity is bundled canonicalKey → lexemeId. Not a second vocab authority
 * for Context Lab presentation.
 */

import {
  BUNDLED_LEXEME_BINDINGS,
  bundledBindingLexemeId,
} from "../../memory-routing/bundled-lexeme-bindings";
import type { SceneLexemeLoader } from "../../content/types";

const MEAL_SCENE_VOCAB: Record<
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

export const mealSceneLexemeLoader: SceneLexemeLoader = (canonicalKey) =>
  MEAL_SCENE_VOCAB[canonicalKey] ?? null;
