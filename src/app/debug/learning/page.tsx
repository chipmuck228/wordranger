import { getVocabularyDataset } from "@/server/vocabulary/dataset";
import {
  buildVocabularyDebugSnapshot,
  learningDebugLexemes,
} from "@/server/vocabulary/debug-view";
import { requireDebugTools } from "@/server/debug-tools/require-debug-tools";
import { LearningDebugLab } from "./learning-debug-lab";

export const dynamic = "force-dynamic";

export default function LearningDebugPage() {
  requireDebugTools();
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
