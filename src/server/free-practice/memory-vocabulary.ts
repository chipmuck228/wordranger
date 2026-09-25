import "server-only";

import { InMemoryVocabularyRepository } from "@/server/vocabulary/in-memory-vocabulary-repository";
import type { Lexeme } from "@/domain/vocabulary/lexeme";
import type { VocabularyDataset } from "@/server/vocabulary/load-vocabulary-dataset";
import type { VocabularySourceEntry } from "@/domain/vocabulary/source-entry";

function lexeme(
  index: number,
  lemma: string,
  meaning: string,
): Lexeme {
  const id = `fp-mem-${String(index).padStart(3, "0")}`;
  return {
    id,
    canonicalKey: id,
    sourceEntryId: `fp-src-${index}`,
    sourceIndex: index,
    lemma,
    display: lemma,
    role: "primary",
    starred: false,
    partsOfSpeech: ["noun"],
    ipa: [],
    forms: [],
    variants: [],
    abbreviationOfLexemeId: null,
    quality: {
      status: "normalized",
      issues: [],
      correctionApplied: false,
      correctionNote: null,
    },
    meaningsZh: [meaning],
  };
}

const source: VocabularySourceEntry = {
  id: "src-fp-memory",
  canonicalKey: "src-fp-memory",
  sourceIndex: 1,
  section: null,
  sourcePageStart: 1,
  sourcePageEnd: 1,
  sourceWordRaw: "free-practice-memory",
  starred: false,
  sourceIpaRaw: null,
  sourcePosRaw: null,
  sourceMeaningRaw: "",
  rawEntry: "",
  parseStatus: "OK",
  parseIssues: [],
  sourceReviewNote: null,
};

export function freePracticeMemoryDataset(): VocabularyDataset {
  const lexemes = [
    lexeme(1, "apple", "苹果"),
    lexeme(2, "bread", "面包"),
    lexeme(3, "water", "水"),
    lexeme(4, "knife", "刀"),
    lexeme(5, "plate", "盘子"),
    lexeme(6, "spoon", "勺子"),
    lexeme(7, "cup", "杯子"),
    lexeme(8, "table", "桌子"),
    lexeme(9, "chair", "椅子"),
    lexeme(10, "door", "门"),
    lexeme(11, "window", "窗户"),
    lexeme(12, "book", "书"),
  ];
  return {
    sourceEntries: [source],
    lexemes,
    relations: [],
    tags: [],
    meta: {
      sourceEntryCount: 1,
      lexemeCount: lexemes.length,
      relationCount: 0,
      taggedLexemeCount: 0,
    },
  };
}

export function createFreePracticeMemoryVocabulary(): InMemoryVocabularyRepository {
  return new InMemoryVocabularyRepository(freePracticeMemoryDataset());
}
