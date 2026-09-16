import "server-only";
import {
  loadVocabularyDataset,
  type VocabularyDataset,
} from "./load-vocabulary-dataset";

let cached: VocabularyDataset | null = null;

export function getVocabularyDataset(): VocabularyDataset {
  if (!cached) {
    cached = loadVocabularyDataset();
  }
  return cached;
}
