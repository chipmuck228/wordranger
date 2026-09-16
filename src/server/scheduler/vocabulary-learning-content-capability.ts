import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";
import type { VocabularyRepository } from "@/domain/vocabulary/vocabulary-repository";
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

export async function buildVocabularyLearningContentCapability(
  vocabulary: VocabularyRepository,
): Promise<LearningContentCapability> {
  const lexemes = await vocabulary.listLexemes();
  const capabilities = new Map<string, LexemeLearningCapability>();
  for (const lexeme of lexemes) {
    const relations = await vocabulary.getRelations(lexeme.id);
    capabilities.set(
      lexeme.id,
      lexemeLearningCapabilityFromContent(lexeme, relations),
    );
  }
  return new MappedLearningContentCapability(capabilities, "unsupported");
}
