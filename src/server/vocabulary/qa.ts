import { placementMetadataIssues } from "@/domain/vocabulary/validate-placement-metadata";
import { relationInvariantIssues } from "@/domain/vocabulary/validate-relation";
import type { VocabularyDataset } from "./load-vocabulary-dataset";

export interface VocabularyQaIssue {
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface VocabularyQaReport {
  sourceEntryCount: number;
  lexemeCount: number;
  relationCount: number;
  tagCount: number;
  placementCount: number;
  issues: VocabularyQaIssue[];
}

export function validateVocabularyDataset(
  dataset: VocabularyDataset,
): VocabularyQaReport {
  const issues: VocabularyQaIssue[] = [];
  const sourceIndexes = dataset.sourceEntries.map((entry) => entry.sourceIndex);
  const expectedIndexes = Array.from(
    { length: dataset.meta.sourceEntryCount },
    (_, index) => index + 1,
  );
  const missing = expectedIndexes.filter(
    (index) => !sourceIndexes.includes(index),
  );
  if (dataset.sourceEntries.length !== dataset.meta.sourceEntryCount) {
    issues.push({
      code: "SOURCE_COUNT_MISMATCH",
      message: `Expected ${dataset.meta.sourceEntryCount} source entries, found ${dataset.sourceEntries.length}`,
    });
  }
  if (missing.length > 0) {
    issues.push({
      code: "SOURCE_INDEX_GAPS",
      message: `Missing source indexes: ${missing.slice(0, 20).join(", ")}`,
      metadata: { missingCount: missing.length },
    });
  }
  if (dataset.lexemes.length !== dataset.meta.lexemeCount) {
    issues.push({
      code: "LEXEME_COUNT_MISMATCH",
      message: `Expected ${dataset.meta.lexemeCount} lexemes, found ${dataset.lexemes.length}`,
    });
  }

  const sourceIds = new Set(dataset.sourceEntries.map((entry) => entry.id));
  for (const lexeme of dataset.lexemes) {
    if (!sourceIds.has(lexeme.sourceEntryId)) {
      issues.push({
        code: "ORPHAN_LEXEME",
        message: `Lexeme ${lexeme.canonicalKey} has no source entry`,
      });
    }
  }

  const lexemeIds = new Set(dataset.lexemes.map((lexeme) => lexeme.id));
  const canonicalKeys = dataset.lexemes.map((lexeme) => lexeme.canonicalKey);
  if (new Set(canonicalKeys).size !== canonicalKeys.length) {
    issues.push({
      code: "DUPLICATE_CANONICAL_KEY",
      message: "Canonical lexeme keys are not unique",
    });
  }

  const relationKeys = new Set<string>();
  for (const relation of dataset.relations) {
    for (const message of relationInvariantIssues(relation)) {
      issues.push({
        code: message.includes("Self relation")
          ? "SELF_RELATION"
          : "RELATION_CONFIDENCE_RANGE",
        message,
      });
    }
    if (
      !lexemeIds.has(relation.fromLexemeId) ||
      !lexemeIds.has(relation.toLexemeId)
    ) {
      issues.push({
        code: "ORPHAN_RELATION",
        message: `Relation ${relation.canonicalKey} has a missing endpoint`,
      });
    }
    const key = `${relation.type}:${relation.fromLexemeId}:${relation.toLexemeId}:${relation.provenance}`;
    if (relationKeys.has(key)) {
      issues.push({
        code: "DUPLICATE_RELATION",
        message: `Duplicate relation ${key}`,
      });
    }
    relationKeys.add(key);
  }

  for (const tag of dataset.tags) {
    if (!lexemeIds.has(tag.lexemeId)) {
      issues.push({
        code: "ORPHAN_TAG",
        message: `Tag record points at missing lexeme ${tag.lexemeId}`,
      });
    }
  }

  const placement = dataset.placementMetadata ?? [];
  issues.push(...placementMetadataIssues(placement, lexemeIds));
  if (dataset.placementOverlay) {
    issues.push(
      ...placementMetadataIssues(dataset.placementOverlay, lexemeIds),
    );
  }
  if (
    dataset.meta.placementMetadataCount !== undefined &&
    placement.length !== dataset.meta.placementMetadataCount
  ) {
    issues.push({
      code: "PLACEMENT_COUNT_MISMATCH",
      message: `Expected ${dataset.meta.placementMetadataCount} placement records, found ${placement.length}`,
    });
  }

  return {
    sourceEntryCount: dataset.sourceEntries.length,
    lexemeCount: dataset.lexemes.length,
    relationCount: dataset.relations.length,
    tagCount: dataset.tags.length,
    placementCount: placement.length,
    issues,
  };
}
