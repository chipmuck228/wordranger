import type { SceneLexemeLoader } from "@/contextual-learning/candidate-v0/content/types";
import { bundledVocabularyRepository } from "./bundled-vocabulary";

/**
 * Scene Content lexeme loader. Display form, Chinese meaning, and IPA
 * come only from bundled vocabulary.
 */
export const bundledSceneLexemeLoader: SceneLexemeLoader = (canonicalKey) => {
  const lexeme = bundledVocabularyRepository().getLexemeByCanonicalKey(canonicalKey);
  if (!lexeme) {
    return null;
  }
  return {
    id: lexeme.id,
    display: lexeme.display,
    lemma: lexeme.lemma,
    meaningsZh: lexeme.meaningsZh,
    ipa: lexeme.ipa,
  };
};
