import type { LearningNeed } from "@/domain/learning/learning-need";
import { PromptMode } from "@/domain/learning/evidence.types";
import { VocabularySkill } from "@/domain/learning/vocabulary-skill";
import type { WeaknessType } from "@/domain/learning/weakness.types";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { LexemeRelation } from "@/domain/vocabulary/lexeme-relation";
import type { VocabularySourceEntry } from "@/domain/vocabulary/source-entry";
import type { VocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";

export function makeNeed(
  overrides: Partial<LearningNeed> & Pick<LearningNeed, "lexemeId" | "targetSkill">,
): LearningNeed {
  return {
    id: "need-1",
    priority: 1,
    reason: "NEW_WORD",
    preferredPromptModes: [],
    avoidRecentTaskTypes: [],
    ...overrides,
  };
}

export function makeNeedWithConfusion(
  lexemeId: string,
  relatedLexemeId: string,
  skill: VocabularySkill = VocabularySkill.MEANING_RECOGNITION,
): LearningNeed {
  return makeNeed({
    lexemeId,
    targetSkill: skill,
    reason: "WEAKNESS",
    weaknessFocus: {
      weaknessId: "weak-1",
      type: "CONFUSION" as WeaknessType,
      relatedLexemeId,
    },
  });
}

export function tinyDataset(params: {
  lexemes: Array<
    Partial<Lexeme> & Pick<Lexeme, "id" | "lemma" | "meaningsZh">
  >;
  relations?: LexemeRelation[];
}): VocabularyDataset {
  const source: VocabularySourceEntry = {
    id: "src-tiny",
    canonicalKey: "src-0001",
    sourceIndex: 1,
    section: null,
    sourcePageStart: 1,
    sourcePageEnd: 1,
    sourceWordRaw: "tiny",
    starred: false,
    sourceIpaRaw: null,
    sourcePosRaw: null,
    sourceMeaningRaw: "",
    rawEntry: "",
    parseStatus: "OK",
    parseIssues: [],
    sourceReviewNote: null,
  };
  const lexemes: Lexeme[] = params.lexemes.map((lexeme, index) => ({
    canonicalKey: lexeme.canonicalKey ?? lexeme.id,
    sourceEntryId: lexeme.sourceEntryId ?? `src-${index}`,
    sourceIndex: lexeme.sourceIndex ?? index + 1,
    display: lexeme.display ?? lexeme.lemma,
    role: lexeme.role ?? "primary",
    starred: false,
    partsOfSpeech: lexeme.partsOfSpeech ?? ["noun"],
    ipa: lexeme.ipa ?? [],
    forms: lexeme.forms ?? [],
    variants: lexeme.variants ?? [],
    abbreviationOfLexemeId: null,
    quality: {
      status: "normalized",
      issues: [],
      correctionApplied: false,
      correctionNote: null,
    },
    ...lexeme,
  }));
  return {
    sourceEntries: [source],
    lexemes,
    relations: params.relations ?? [],
    tags: [],
    meta: {
      sourceEntryCount: 1,
      lexemeCount: lexemes.length,
      relationCount: params.relations?.length ?? 0,
      taggedLexemeCount: 0,
    },
  };
}

export { PromptMode };
