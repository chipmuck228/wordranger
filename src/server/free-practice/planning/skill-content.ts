import "server-only";

import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";
import { selectApprovedRelations } from "@/domain/vocabulary/relation-policy";
import { DEFAULT_VOCABULARY_CONTENT_POLICY } from "@/domain/vocabulary/vocabulary-content-policy";

function usableText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasUsableMeaning(lexeme: Lexeme): boolean {
  return lexeme.meaningsZh.some((meaning) => usableText(meaning));
}

export function hasUsableLemma(lexeme: Lexeme): boolean {
  return usableText(lexeme.lemma) || usableText(lexeme.display);
}

export const FREE_PRACTICE_GENERATABLE_SKILLS = [
  VocabularySkill.MEANING_RECOGNITION,
  VocabularySkill.ACTIVE_RECALL,
  VocabularySkill.SPELLING_RECALL,
  VocabularySkill.SEMANTIC_CONNECTION,
] as const;

export function canGenerateFreePracticeSkill(
  lexeme: Lexeme,
  skill: VocabularySkill,
  hasApprovedRelation: boolean,
): boolean {
  switch (skill) {
    case VocabularySkill.MEANING_RECOGNITION:
      return hasUsableMeaning(lexeme);
    case VocabularySkill.ACTIVE_RECALL:
    case VocabularySkill.SPELLING_RECALL:
      return hasUsableMeaning(lexeme) && hasUsableLemma(lexeme);
    case VocabularySkill.SEMANTIC_CONNECTION:
      return hasApprovedRelation;
    case VocabularySkill.LISTENING_RECOGNITION:
    case VocabularySkill.CONTEXT_USE:
      return false;
    default:
      return false;
  }
}

/**
 * Production-approved relations indexed the same way getRelations()
 * does: fromLexemeId always, toLexemeId only when the edge is
 * symmetric. Used only to decide whether SEMANTIC_CONNECTION has
 * required content. Not a Scheduler capability map.
 */
export function indexApprovedRelationsByLexeme(
  relations: readonly LexemeRelation[],
): Map<string, LexemeRelation[]> {
  const approved = selectApprovedRelations(
    relations,
    DEFAULT_VOCABULARY_CONTENT_POLICY,
  );
  const byLexeme = new Map<string, LexemeRelation[]>();
  const seenIds = new Map<string, Set<string>>();

  function add(lexemeId: string, relation: LexemeRelation): void {
    const ids = seenIds.get(lexemeId) ?? new Set<string>();
    if (ids.has(relation.id)) {
      return;
    }
    ids.add(relation.id);
    seenIds.set(lexemeId, ids);
    const list = byLexeme.get(lexemeId) ?? [];
    list.push(relation);
    byLexeme.set(lexemeId, list);
  }

  for (const relation of approved) {
    add(relation.fromLexemeId, relation);
    if (
      relation.symmetric &&
      relation.toLexemeId !== relation.fromLexemeId
    ) {
      add(relation.toLexemeId, relation);
    }
  }
  return byLexeme;
}
