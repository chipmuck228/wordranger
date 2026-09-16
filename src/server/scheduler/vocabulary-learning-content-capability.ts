import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";
import {
  MappedLearningContentCapability,
  V1_BLOCKED_SKILL_REASONS,
  type LearningContentCapability,
  type LexemeLearningCapability,
} from "@/domain/scheduler/learning-content-capability";

function usableText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUsableMeaning(lexeme: Lexeme): boolean {
  return lexeme.meaningsZh.some((meaning) => usableText(meaning));
}

function hasUsableLemma(lexeme: Lexeme): boolean {
  return usableText(lexeme.lemma) || usableText(lexeme.display);
}

/**
 * Index production-approved relations the same way getRelations() does:
 * fromLexemeId always, toLexemeId only when the edge is symmetric.
 * O(R). Guards against adding the same edge twice if from === to.
 */
export function indexRelationsByLexeme(
  relations: readonly LexemeRelation[],
): Map<string, LexemeRelation[]> {
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

  for (const relation of relations) {
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

export function lexemeLearningCapabilityFromContent(
  lexeme: Lexeme,
  approvedRelations: readonly LexemeRelation[],
): LexemeLearningCapability {
  const reasons: LexemeLearningCapability["reasons"] = {
    ...V1_BLOCKED_SKILL_REASONS,
  };
  const supportedSkills: VocabularySkill[] = [];
  const usableMeaning = hasUsableMeaning(lexeme);
  const usableLemma = hasUsableLemma(lexeme);

  if (usableMeaning) {
    supportedSkills.push(VocabularySkill.MEANING_RECOGNITION);
  } else {
    reasons[VocabularySkill.MEANING_RECOGNITION] = [
      "No usable Chinese meaning",
    ];
  }

  if (usableMeaning && usableLemma) {
    supportedSkills.push(VocabularySkill.ACTIVE_RECALL);
    supportedSkills.push(VocabularySkill.SPELLING_RECALL);
  } else {
    const missing: string[] = [];
    if (!usableMeaning) {
      missing.push("No usable Chinese meaning");
    }
    if (!usableLemma) {
      missing.push("No usable lemma");
    }
    reasons[VocabularySkill.ACTIVE_RECALL] = missing;
    reasons[VocabularySkill.SPELLING_RECALL] = missing;
  }

  if (approvedRelations.length > 0) {
    supportedSkills.push(VocabularySkill.SEMANTIC_CONNECTION);
  } else {
    reasons[VocabularySkill.SEMANTIC_CONNECTION] = [
      "No production-approved relation available for SEMANTIC_CONNECTION",
    ];
  }

  return {
    lexemeId: lexeme.id,
    supportedSkills,
    reasons,
  };
}

/**
 * Pure O(L + R) capability map from already-loaded production lexemes
 * and production-approved relations. Does not query VocabularyRepository.
 */
export function buildVocabularyLearningContentCapability(
  lexemes: readonly Lexeme[],
  relations: readonly LexemeRelation[],
): LearningContentCapability {
  const relationsByLexemeId = indexRelationsByLexeme(relations);
  const capabilities = new Map<string, LexemeLearningCapability>();
  for (const lexeme of lexemes) {
    capabilities.set(
      lexeme.id,
      lexemeLearningCapabilityFromContent(
        lexeme,
        relationsByLexemeId.get(lexeme.id) ?? [],
      ),
    );
  }
  return new MappedLearningContentCapability(capabilities, "unsupported");
}
