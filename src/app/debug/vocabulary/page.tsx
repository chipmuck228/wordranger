import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { buildVocabularyDebugSnapshot } from "@/server/vocabulary/debug-view";
import { VocabularyDebugLab } from "./vocabulary-debug-lab";

export default function VocabularyDebugPage() {
  const snapshot = buildVocabularyDebugSnapshot(getVocabularyDataset());
  return <VocabularyDebugLab snapshot={snapshot} />;
}
