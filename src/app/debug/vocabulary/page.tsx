import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { buildVocabularyDebugSnapshot } from "@/server/vocabulary/debug-view";
import { requireDebugTools } from "@/server/debug-tools/require-debug-tools";
import { VocabularyDebugLab } from "./vocabulary-debug-lab";

export const dynamic = "force-dynamic";

export default function VocabularyDebugPage() {
  requireDebugTools();
  const snapshot = buildVocabularyDebugSnapshot(getVocabularyDataset());
  return <VocabularyDebugLab snapshot={snapshot} />;
}
