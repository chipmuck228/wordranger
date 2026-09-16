import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import { loadVocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

let bundledVocabulary: InMemoryVocabularyRepository | null = null;

/**
 * Immutable bundled vocabulary shared by every student-facing game runtime.
 */
export function bundledVocabularyRepository(): InMemoryVocabularyRepository {
  bundledVocabulary ??= new InMemoryVocabularyRepository(loadVocabularyDataset());
  return bundledVocabulary;
}
