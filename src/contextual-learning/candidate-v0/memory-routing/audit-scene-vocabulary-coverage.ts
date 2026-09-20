/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Read-only coverage auditor. Does not assign remaining vocabulary.
 */

import {
  BUNDLED_VOCABULARY_PROVENANCE,
  type SceneVocabularyCluster,
  type SceneVocabularyCoverageReport,
  type VocabularyLexemeIdentity,
} from "./types";
import { validateSceneVocabularyCatalog } from "./validate-scene-catalog";

export function auditSceneVocabularyCoverage(
  vocabulary: readonly VocabularyLexemeIdentity[],
  clusters: readonly SceneVocabularyCluster[],
): SceneVocabularyCoverageReport {
  const orderedVocabulary = [...vocabulary].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const orderedClusters = [...clusters].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const invalidAssignments = validateSceneVocabularyCatalog(
    orderedClusters,
    orderedVocabulary,
  );

  const knownIds = new Set(orderedVocabulary.map((lexeme) => lexeme.id));
  const assignedIds = new Set<string>();
  const clusterCounts: Record<string, number> = {};
  for (const cluster of orderedClusters) {
    clusterCounts[cluster.id] = cluster.members.length;
    for (const member of cluster.members) {
      const lexemeId = member.target.lexemeId;
      if (lexemeId && knownIds.has(lexemeId)) {
        assignedIds.add(lexemeId);
      }
    }
  }

  const assignedLexemes = assignedIds.size;
  let ambiguousSenseLexemes = 0;
  for (const lexeme of orderedVocabulary) {
    const mapped = assignedIds.has(lexeme.id);
    if (!mapped && lexeme.meaningsZh.length > 1) {
      ambiguousSenseLexemes += 1;
    }
  }

  return {
    vocabularyVersion: BUNDLED_VOCABULARY_PROVENANCE,
    totalLexemes: orderedVocabulary.length,
    assignedLexemes,
    unassignedLexemes: orderedVocabulary.length - assignedLexemes,
    ambiguousSenseLexemes,
    invalidAssignments,
    clusterCounts,
  };
}
