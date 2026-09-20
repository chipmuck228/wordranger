/**
 * Contextual Memory Routing Candidate V0.
 * Status: Candidate / Experimental / Not a Standard.
 *
 * Read-only catalog checks. Does not mutate vocabulary.
 */

import { lexemeIdFromCanonicalKey } from "@/lib/canonical-id";
import { lexemeSenseKey } from "../domain/lexeme-sense";
import {
  SCENE_VOCABULARY_CATALOG_VERSION,
  type SceneVocabularyCluster,
  type SceneVocabularyCoverageIssue,
  type VocabularyLexemeIdentity,
} from "./types";

export function validateSceneVocabularyCatalog(
  clusters: readonly SceneVocabularyCluster[],
  vocabulary: readonly VocabularyLexemeIdentity[],
): SceneVocabularyCoverageIssue[] {
  const lexemesById = new Map(vocabulary.map((lexeme) => [lexeme.id, lexeme]));
  const issues: SceneVocabularyCoverageIssue[] = [];

  for (const cluster of clusters) {
    issues.push(...validateCluster(cluster, lexemesById));
  }

  return sortIssues(issues);
}

function validateCluster(
  cluster: SceneVocabularyCluster,
  lexemesById: Map<string, VocabularyLexemeIdentity>,
): SceneVocabularyCoverageIssue[] {
  const issues: SceneVocabularyCoverageIssue[] = [];

  if (!cluster.id.trim() || !cluster.title.trim() || !cluster.semanticScope.trim()) {
    issues.push({
      code: "SCENE_CATALOG_UNSUPPORTED_SCHEMA",
      clusterId: cluster.id,
      message: `Cluster ${cluster.id || "(missing id)"} is missing required schema fields`,
    });
  }

  if (cluster.version !== SCENE_VOCABULARY_CATALOG_VERSION) {
    issues.push({
      code: "SCENE_CATALOG_UNSUPPORTED_VERSION",
      clusterId: cluster.id,
      message: `Cluster ${cluster.id} version ${cluster.version} is not ${SCENE_VOCABULARY_CATALOG_VERSION}`,
    });
  }

  if (!Array.isArray(cluster.members) || !Array.isArray(cluster.allowedRoleIds)) {
    issues.push({
      code: "SCENE_CATALOG_UNSUPPORTED_SCHEMA",
      clusterId: cluster.id,
      message: `Cluster ${cluster.id} members/allowedRoleIds must be arrays`,
    });
    return issues;
  }

  const seen = new Set<string>();
  const allowedRoles = new Set(cluster.allowedRoleIds);

  for (const member of cluster.members) {
    const lexemeId = member.target?.lexemeId ?? "";
    const senseId = member.target?.senseId ?? "";
    const identity = lexemeSenseKey({ lexemeId, senseId });

    if (!senseId.trim()) {
      const lexeme = lexemesById.get(lexemeId);
      issues.push({
        code:
          lexeme && lexeme.meaningsZh.length > 1
            ? "SCENE_MEMBER_AMBIGUOUS_SENSE"
            : "SCENE_MEMBER_MISSING_SENSE",
        clusterId: cluster.id,
        lexemeId,
        canonicalKey: member.lexemeCanonicalKey,
        message: `Cluster ${cluster.id} member ${lexemeId || member.lexemeCanonicalKey} has no explicit senseId`,
      });
    }

    if (seen.has(identity) && lexemeId && senseId) {
      issues.push({
        code: "SCENE_MEMBER_DUPLICATE_IDENTITY",
        clusterId: cluster.id,
        lexemeId,
        senseId,
        canonicalKey: member.lexemeCanonicalKey,
        message: `Cluster ${cluster.id} repeats ${identity}`,
      });
    }
    if (lexemeId && senseId) {
      seen.add(identity);
    }

    if (!allowedRoles.has(member.roleId)) {
      issues.push({
        code: "SCENE_MEMBER_ILLEGAL_ROLE",
        clusterId: cluster.id,
        lexemeId,
        senseId,
        canonicalKey: member.lexemeCanonicalKey,
        message: `Cluster ${cluster.id} role ${member.roleId} is not in the structured role registry`,
      });
    }

    const lexeme = lexemesById.get(lexemeId);
    if (!lexeme) {
      issues.push({
        code: "SCENE_MEMBER_UNKNOWN_LEXEME",
        clusterId: cluster.id,
        lexemeId,
        senseId,
        canonicalKey: member.lexemeCanonicalKey,
        message: `Cluster ${cluster.id} lexeme ${lexemeId} is not in bundled vocabulary`,
      });
      continue;
    }

    if (
      lexeme.canonicalKey !== member.lexemeCanonicalKey ||
      lexeme.id !== lexemeIdFromCanonicalKey(member.lexemeCanonicalKey)
    ) {
      issues.push({
        code: "SCENE_MEMBER_CANONICAL_KEY_MISMATCH",
        clusterId: cluster.id,
        lexemeId,
        senseId,
        canonicalKey: member.lexemeCanonicalKey,
        message: `Cluster ${cluster.id} canonical key ${member.lexemeCanonicalKey} does not match UUID ${lexemeId}`,
      });
    }
  }

  return issues;
}

function sortIssues(
  issues: SceneVocabularyCoverageIssue[],
): SceneVocabularyCoverageIssue[] {
  return [...issues].sort((left, right) => {
    return [
      left.code,
      left.clusterId ?? "",
      left.lexemeId ?? "",
      left.senseId ?? "",
      left.canonicalKey ?? "",
      left.message,
    ]
      .join("\u0000")
      .localeCompare(
        [
          right.code,
          right.clusterId ?? "",
          right.lexemeId ?? "",
          right.senseId ?? "",
          right.canonicalKey ?? "",
          right.message,
        ].join("\u0000"),
      );
  });
}
