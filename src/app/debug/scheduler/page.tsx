import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { SchedulerDebugLab } from "./scheduler-debug-lab";

export default function SchedulerDebugPage() {
  const lexemes = getVocabularyDataset().lexemes.map((lexeme) => ({
    id: lexeme.id,
    lemma: lexeme.lemma,
    display: lexeme.display,
  }));
  return <SchedulerDebugLab lexemes={lexemes} />;
}
