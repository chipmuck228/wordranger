import type { LexemeRelation } from "./lexeme-relation";
import type { VocabularyContentPolicy } from "./vocabulary-content-policy";

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
