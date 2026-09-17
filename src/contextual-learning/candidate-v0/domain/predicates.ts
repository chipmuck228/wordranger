/**
 * Candidate V0 / Experimental / Not a Standard.
 *
 * Closed, serializable predicate representation.
 * No eval, Function, or executable callbacks.
 */

export type SemanticValue =
  | { kind: "ENTITY"; entityId: string }
  | { kind: "ROLE"; roleId: string }
  | { kind: "CONCEPT"; conceptId: string }
  | { kind: "LITERAL"; value: string | number | boolean };

export interface SemanticFact {
  predicate: string;
  arguments: SemanticValue[];
  truth: true;
}

export interface SemanticPredicate {
  predicate: string;
  arguments: SemanticValue[];
  expected: boolean;
}

export interface SemanticQuery {
  query: string;
  arguments: SemanticValue[];
}

export interface SemanticEffect {
  operation: "ASSERT" | "RETRACT" | "SET";
  fact: SemanticFact;
}

export function semanticValueKey(value: SemanticValue): string {
  switch (value.kind) {
    case "ENTITY":
      return `entity:${value.entityId}`;
    case "ROLE":
      return `role:${value.roleId}`;
    case "CONCEPT":
      return `concept:${value.conceptId}`;
    case "LITERAL":
      return `literal:${String(value.value)}`;
  }
}

export function serializePredicate(predicate: SemanticPredicate): string {
  const args = predicate.arguments.map(semanticValueKey).join(", ");
  return `${predicate.predicate}(${args})=${String(predicate.expected)}`;
}

export function serializeFact(fact: SemanticFact): string {
  const args = fact.arguments.map(semanticValueKey).join(", ");
  return `${fact.predicate}(${args})`;
}

export function collectReferencedIds(values: readonly SemanticValue[]): {
  entityIds: string[];
  roleIds: string[];
  conceptIds: string[];
} {
  const entityIds: string[] = [];
  const roleIds: string[] = [];
  const conceptIds: string[] = [];
  for (const value of values) {
    if (value.kind === "ENTITY") {
      entityIds.push(value.entityId);
    } else if (value.kind === "ROLE") {
      roleIds.push(value.roleId);
    } else if (value.kind === "CONCEPT") {
      conceptIds.push(value.conceptId);
    }
  }
  return { entityIds, roleIds, conceptIds };
}

export function predicateMentions(
  predicate: SemanticPredicate | SemanticQuery,
  needle: string,
): boolean {
  const haystack = JSON.stringify(predicate).toLowerCase();
  return haystack.includes(needle.toLowerCase());
}
