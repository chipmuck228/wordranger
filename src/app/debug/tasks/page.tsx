import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import { buildVocabularyDebugSnapshot } from "@/server/vocabulary/debug-view";
import { requireDebugTools } from "@/server/debug-tools/require-debug-tools";
import { TaskDebugLab } from "./task-debug-lab";

export const dynamic = "force-dynamic";

export default function TaskDebugPage() {
  requireDebugTools();
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
