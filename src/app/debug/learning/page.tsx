import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import {
  buildVocabularyDebugSnapshot,
  learningDebugLexemes,
} from "@/server/vocabulary/debug-view";
import { LearningDebugLab } from "./learning-debug-lab";

export default function LearningDebugPage() {
  const snapshot = buildVocabularyDebugSnapshot(getVocabularyDataset());
  const lexemes = learningDebugLexemes(snapshot, [
    "quiet",
    "environment",
    "increase",
  ]);
  const quite =
    snapshot.lexemes.find((lexeme) => lexeme.lemma === "quite") ?? lexemes[0];
  return (
    <LearningDebugLab
      lexemes={lexemes}
      confusedLexemeId={quite?.id ?? lexemes[0]?.id ?? ""}
    />
  );
}
