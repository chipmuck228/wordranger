import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { buildVocabularyDebugSnapshot } from "@/server/vocabulary/debug-view";
import { TaskDebugLab } from "./task-debug-lab";

export default function TaskDebugPage() {
  const snapshot = buildVocabularyDebugSnapshot(getVocabularyDataset());
  const lexemes = snapshot.lexemes.map((lexeme) => ({
    id: lexeme.id,
    lemma: lexeme.lemma,
    display: lexeme.display,
    meaningsZh: lexeme.meaningsZh,
    ipa: lexeme.ipa,
    tags: lexeme.tags,
    relations: lexeme.relations,
  }));
  return <TaskDebugLab lexemes={lexemes} />;
}
