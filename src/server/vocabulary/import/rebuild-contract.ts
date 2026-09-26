import { createHash } from "node:crypto";
import type { VocabularyDataset } from "../load-vocabulary-dataset";
import { planVocabularyImport } from "./plan-import";

export interface VocabularyRebuildManifest {
  sourceEntries: number;
  lexemes: number;
  relations: number;
  tags: number;
  rejectedRelations: number;
  qaIssueCount: number;
  fingerprint: string;
}

function sortedJoin(values: Array<string | null | undefined>): string {
  return values
    .map((value) => value ?? "")
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Server/admin rebuild contract over bundled vocabulary only.
 * Deterministic. Does not write learner state, Evidence, or Scheduler input.
 * Does not open a remote database.
 */
export function buildVocabularyRebuildManifest(
  dataset: VocabularyDataset,
): VocabularyRebuildManifest {
  const plan = planVocabularyImport(dataset, "validate");
  const fingerprint = sha256(
    [
      `sourceEntries:${sortedJoin(dataset.sourceEntries.map((entry) => entry.canonicalKey))}`,
      `lexemes:${sortedJoin(dataset.lexemes.map((lexeme) => lexeme.canonicalKey))}`,
      `relations:${sortedJoin(dataset.relations.map((relation) => relation.canonicalKey))}`,
      `tags:${sortedJoin(dataset.tags.map((tag) => tag.lexemeId))}`,
    ].join("\n"),
  );
  return {
    sourceEntries: plan.sourceEntries,
    lexemes: plan.lexemes,
    relations: plan.relations,
    tags: plan.tags,
    rejectedRelations: plan.rejectedRelations,
    qaIssueCount: plan.qaIssueCount,
    fingerprint,
  };
}

export function assertVocabularyRebuildMatches(
  expected: VocabularyRebuildManifest,
  observed: Pick<
    VocabularyRebuildManifest,
    "sourceEntries" | "lexemes" | "relations" | "tags" | "fingerprint"
  >,
): void {
  if (
    expected.sourceEntries !== observed.sourceEntries ||
    expected.lexemes !== observed.lexemes ||
    expected.relations !== observed.relations ||
    expected.tags !== observed.tags ||
    expected.fingerprint !== observed.fingerprint
  ) {
    throw new Error("Vocabulary rebuild fingerprint mismatch");
  }
}
