import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { requireDebugTools } from "@/server/debug-tools/require-debug-tools";
import { SchedulerDebugLab } from "./scheduler-debug-lab";

export const dynamic = "force-dynamic";

export default function SchedulerDebugPage() {
  requireDebugTools();
  const lexemes = getVocabularyDataset().lexemes.map((lexeme) => ({
    id: lexeme.id,
    lemma: lexeme.lemma,
    display: lexeme.display,
  }));
  return <SchedulerDebugLab lexemes={lexemes} />;
}
