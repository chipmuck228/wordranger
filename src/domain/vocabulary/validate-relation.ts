import type { LexemeRelation } from "./lexeme-relation";

export function relationInvariantIssues(
  relation: Pick<
    LexemeRelation,
    "fromLexemeId" | "toLexemeId" | "confidence" | "canonicalKey"
  >,
): string[] {
  const issues: string[] = [];
  if (relation.fromLexemeId === relation.toLexemeId) {
    issues.push(`Self relation is not allowed (${relation.canonicalKey})`);
  }
  if (relation.confidence < 0 || relation.confidence > 1) {
    issues.push(
      `Relation confidence ${relation.confidence} is outside 0..1 (${relation.canonicalKey})`,
    );
  }
  return issues;
}

export function assertRelationInvariants(
  relation: Pick<
    LexemeRelation,
    "fromLexemeId" | "toLexemeId" | "confidence" | "canonicalKey"
  >,
): void {
  const issues = relationInvariantIssues(relation);
  if (issues.length > 0) {
    throw new Error(issues.join("; "));
  }
}
