import { LexemeRelationType } from "@/domain/vocabulary/lexeme-relation";
import { relationMeetsContentPolicy } from "@/domain/vocabulary/relation-policy";
import { DEFAULT_VOCABULARY_CONTENT_POLICY } from "@/domain/vocabulary/vocabulary-content-policy";
import { InMemoryVocabularyRepository } from "./in-memory-vocabulary-repository";
import type { VocabularyDataset } from "./load-vocabulary-dataset";
import { validateVocabularyDataset } from "./qa";

export interface VocabularyDebugLexeme {
  id: string;
  canonicalKey: string;
  lemma: string;
  display: string;
  role: string;
  starred: boolean;
  sourceIndex: number;
  sourceEntryId: string;
  partsOfSpeech: string[];
  ipa: string[];
  meaningsZh: string[];
  forms: string[];
  variants: string[];
  quality: {
    status: string;
    issues: string[];
    correctionApplied: boolean;
    correctionNote: string | null;
  };
  sourceWordRaw: string;
  rawEntry: string;
  sourceMeaningRaw: string;
  relations: Array<{
    type: string;
    otherLemma: string;
    otherLexemeId: string;
    provenance: string;
    confidence: number;
    productionUsable: boolean;
  }>;
  tags: {
    topics: string[];
    semanticCategories: string[];
    gameTags: string[];
  } | null;
}

export interface VocabularyDebugSnapshot {
  sourceEntryCount: number;
  lexemeCount: number;
  relationCount: number;
  tagCount: number;
  relationTypeCounts: Record<string, number>;
  provenanceCounts: Record<string, number>;
  qaIssueCount: number;
  qaIssues: string[];
  rejectedRelationCount: number;
  lexemes: VocabularyDebugLexeme[];
}

function otherLexemeId(from: string, to: string, self: string): string {
  return from === self ? to : from;
}

export function buildVocabularyDebugSnapshot(
  dataset: VocabularyDataset,
): VocabularyDebugSnapshot {
  const qa = validateVocabularyDataset(dataset);
  const repository = new InMemoryVocabularyRepository(dataset);
  const lexemeById = new Map(dataset.lexemes.map((lexeme) => [lexeme.id, lexeme]));
  const tagsByLexeme = new Map(dataset.tags.map((tag) => [tag.lexemeId, tag]));
  const relationTypeCounts: Record<string, number> = {};
  const provenanceCounts: Record<string, number> = {};
  for (const type of Object.values(LexemeRelationType)) {
    relationTypeCounts[type] = 0;
  }
  for (const relation of dataset.relations) {
    relationTypeCounts[relation.type] =
      (relationTypeCounts[relation.type] ?? 0) + 1;
    provenanceCounts[relation.provenance] =
      (provenanceCounts[relation.provenance] ?? 0) + 1;
  }

  const lexemes: VocabularyDebugLexeme[] = dataset.lexemes.map((lexeme) => {
    const source = repository.getSourceEntry(lexeme.sourceEntryId);
    const allRelations = dataset.relations.filter(
      (relation) =>
        relation.fromLexemeId === lexeme.id ||
        (relation.symmetric && relation.toLexemeId === lexeme.id),
    );
    return {
      id: lexeme.id,
      canonicalKey: lexeme.canonicalKey,
      lemma: lexeme.lemma,
      display: lexeme.display,
      role: lexeme.role,
      starred: lexeme.starred,
      sourceIndex: lexeme.sourceIndex,
      sourceEntryId: lexeme.sourceEntryId,
      partsOfSpeech: lexeme.partsOfSpeech,
      ipa: lexeme.ipa,
      meaningsZh: lexeme.meaningsZh,
      forms: lexeme.forms,
      variants: lexeme.variants,
      quality: lexeme.quality,
      sourceWordRaw: source?.sourceWordRaw ?? "",
      rawEntry: source?.rawEntry ?? "",
      sourceMeaningRaw: source?.sourceMeaningRaw ?? "",
      relations: allRelations.map((relation) => {
        const otherId = otherLexemeId(
          relation.fromLexemeId,
          relation.toLexemeId,
          lexeme.id,
        );
        return {
          type: relation.type,
          otherLemma: lexemeById.get(otherId)?.lemma ?? otherId,
          otherLexemeId: otherId,
          provenance: relation.provenance,
          confidence: relation.confidence,
          productionUsable: relationMeetsContentPolicy(
            relation,
            DEFAULT_VOCABULARY_CONTENT_POLICY,
          ),
        };
      }),
      tags: tagsByLexeme.get(lexeme.id)
        ? {
            topics: tagsByLexeme.get(lexeme.id)?.topics ?? [],
            semanticCategories:
              tagsByLexeme.get(lexeme.id)?.semanticCategories ?? [],
            gameTags: tagsByLexeme.get(lexeme.id)?.gameTags ?? [],
          }
        : null,
    };
  });

  return {
    sourceEntryCount: dataset.sourceEntries.length,
    lexemeCount: dataset.lexemes.length,
    relationCount: dataset.relations.length,
    tagCount: dataset.tags.length,
    relationTypeCounts,
    provenanceCounts,
    qaIssueCount: qa.issues.length,
    qaIssues: qa.issues.map((issue) => `${issue.code}: ${issue.message}`),
    rejectedRelationCount: dataset.relations.filter(
      (relation) =>
        !relationMeetsContentPolicy(
          relation,
          DEFAULT_VOCABULARY_CONTENT_POLICY,
        ),
    ).length,
    lexemes,
  };
}

export function learningDebugLexemes(
  snapshot: VocabularyDebugSnapshot,
  lemmas: string[],
): VocabularyDebugLexeme[] {
  return lemmas
    .map(
      (lemma) =>
        snapshot.lexemes.find(
          (lexeme) => lexeme.lemma.toLowerCase() === lemma.toLowerCase(),
        ) ?? null,
    )
    .filter((lexeme): lexeme is VocabularyDebugLexeme => lexeme !== null);
}
