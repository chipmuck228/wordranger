import { loadVocabularyDataset } from "../src/server/vocabulary/load-vocabulary-dataset";
import { auditSceneVocabularyCoverage } from "../src/contextual-learning/candidate-v0/memory-routing/audit-scene-vocabulary-coverage";
import { SCENE_VOCABULARY_CLUSTERS } from "../src/contextual-learning/candidate-v0/memory-routing/scene-catalog";

function main() {
  const dataset = loadVocabularyDataset();
  const report = auditSceneVocabularyCoverage(dataset.lexemes, SCENE_VOCABULARY_CLUSTERS);
  console.log(JSON.stringify(report, null, 2));
  if (report.invalidAssignments.length > 0) {
    process.exitCode = 1;
  }
}

main();
