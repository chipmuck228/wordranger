import type { LexemeRelation } from "./lexeme-relation";
import type { VocabularyContentPolicy } from "./vocabulary-content-policy";
import type { GetRelationsOptions } from "./vocabulary-repository";

export function relationMeetsContentPolicy(
  relation: LexemeRelation,
  policy: VocabularyContentPolicy,
): boolean {
  if (relation.confidence < 0 || relation.confidence > 1) {
    return false;
  }
  if (relation.provenance === "rule_inferred") {
    return (
      policy.allowRuleInferredInProduction &&
      relation.confidence >= policy.minimumRelationConfidence.ruleInferred
    );
  }
  if (relation.provenance === "source_structural") {
    return (
      relation.confidence >= policy.minimumRelationConfidence.sourceStructural
    );
  }
  return relation.confidence >= policy.minimumRelationConfidence.curatedModel;
}

/**
 * Production query = policy ∩ caller filters.
 * Caller filters may only shrink the policy-approved set.
 */
export function selectApprovedRelations(
  relations: readonly LexemeRelation[],
  policy: VocabularyContentPolicy,
  options: GetRelationsOptions = {},
): LexemeRelation[] {
  return relations.filter((relation) => {
    if (!relationMeetsContentPolicy(relation, policy)) {
      return false;
    }
    if (options.types && !options.types.includes(relation.type)) {
      return false;
    }
    if (
      options.provenances &&
      !options.provenances.includes(relation.provenance)
    ) {
      return false;
    }
    if (
      options.minConfidence !== undefined &&
      relation.confidence < options.minConfidence
    ) {
      return false;
    }
    return true;
  });
}

export function sortLexemeRelations(
  relations: readonly LexemeRelation[],
): LexemeRelation[] {
  return [...relations].sort((left, right) => {
    const type = left.type.localeCompare(right.type);
    if (type !== 0) {
      return type;
    }
    const from = left.fromLexemeId.localeCompare(right.fromLexemeId);
    if (from !== 0) {
      return from;
    }
    const to = left.toLexemeId.localeCompare(right.toLexemeId);
    if (to !== 0) {
      return to;
    }
    return left.id.localeCompare(right.id);
  });
}
