import { createHash } from "node:crypto";
import type { VocabularyDataset } from "../load-vocabulary-dataset";
import {
  toVocabularyImportRows,
  type VocabularyImportRows,
} from "./import-rows";
import { planVocabularyImport } from "./plan-import";

export const VOCABULARY_CONTENT_FINGERPRINT_VERSION =
  "vocabulary-content-v1" as const;

export interface VocabularySeedManifest {
  algorithmVersion: typeof VOCABULARY_CONTENT_FINGERPRINT_VERSION;
  sourceEntries: number;
  lexemes: number;
  relations: number;
  tags: number;
  rejectedRelations: number;
  qaIssueCount: number;
  fingerprint: string;
}

/** @deprecated Use VocabularySeedManifest. Empty-target seed + upsert, not a delete-rebuild. */
export type VocabularyRebuildManifest = VocabularySeedManifest;

export interface EffectiveVocabularyImportRows {
  sourceEntries: Record<string, unknown>[];
  lexemes: Record<string, unknown>[];
  relations: Record<string, unknown>[];
  tags: Record<string, unknown>[];
}

function compareIdentity(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rowIdentity(
  row: Record<string, unknown>,
  keys: readonly string[],
): string {
  return keys.map((key) => String(row[key] ?? "")).join("\0");
}

function sortRows(
  rows: Record<string, unknown>[],
  keys: readonly string[],
): Record<string, unknown>[] {
  return [...rows].sort((left, right) =>
    compareIdentity(rowIdentity(left, keys), rowIdentity(right, keys)),
  );
}

/**
 * Canonical serialization: object keys recursively sorted, arrays keep
 * business order, null !== "", and number/boolean/string stay typed.
 * Do not JSON.stringify an unnormalized object.
 */
export function canonicalizeVocabularyValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `s:${JSON.stringify(value)}`;
  }
  if (typeof value === "boolean") {
    return value ? "b:true" : "b:false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Vocabulary fingerprint rejects non-finite numbers");
    }
    return `n:${value}`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeVocabularyValue(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort(compareIdentity);
    return `{${keys
      .map(
        (key) =>
          `${canonicalizeVocabularyValue(key)}:${canonicalizeVocabularyValue(
            (value as Record<string, unknown>)[key],
          )}`,
      )
      .join(",")}}`;
  }
  throw new Error(`Unsupported fingerprint value type: ${typeof value}`);
}

function applyAbbreviationUpdates(
  lexemes: Record<string, unknown>[],
  updates: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byId = new Map(
    updates.map((row) => [String(row.id), row.abbreviation_of_lexeme_id]),
  );
  return lexemes.map((row) => ({
    ...row,
    abbreviation_of_lexeme_id:
      byId.get(String(row.id)) ?? row.abbreviation_of_lexeme_id ?? null,
  }));
}

/** Final imported vocabulary content. created_at / updated_at are omitted. */
export function effectiveVocabularyImportRows(
  rows: VocabularyImportRows,
): EffectiveVocabularyImportRows {
  return {
    sourceEntries: sortRows(rows.sourceEntries, ["id"]),
    lexemes: sortRows(
      applyAbbreviationUpdates(rows.lexemes, rows.lexemeAbbreviationUpdates),
      ["id"],
    ),
    relations: sortRows(rows.relations, ["id"]),
    tags: sortRows(rows.tags, ["lexeme_id"]),
  };
}

export function fingerprintVocabularyImportRows(
  rows: VocabularyImportRows,
): {
  algorithmVersion: typeof VOCABULARY_CONTENT_FINGERPRINT_VERSION;
  fingerprint: string;
} {
  const effective = effectiveVocabularyImportRows(rows);
  const payload = canonicalizeVocabularyValue({
    algorithmVersion: VOCABULARY_CONTENT_FINGERPRINT_VERSION,
    sourceEntries: effective.sourceEntries,
    lexemes: effective.lexemes,
    relations: effective.relations,
    tags: effective.tags,
  });
  return {
    algorithmVersion: VOCABULARY_CONTENT_FINGERPRINT_VERSION,
    fingerprint: createHash("sha256").update(payload, "utf8").digest("hex"),
  };
}

/**
 * Empty-target seed + deterministic upsert contract.
 * Does not delete stale remote rows. Does not write learner state.
 */
export function buildVocabularySeedManifest(
  dataset: VocabularyDataset,
): VocabularySeedManifest {
  const plan = planVocabularyImport(dataset, "validate");
  const printed = fingerprintVocabularyImportRows(toVocabularyImportRows(dataset));
  return {
    algorithmVersion: printed.algorithmVersion,
    sourceEntries: plan.sourceEntries,
    lexemes: plan.lexemes,
    relations: plan.relations,
    tags: plan.tags,
    rejectedRelations: plan.rejectedRelations,
    qaIssueCount: plan.qaIssueCount,
    fingerprint: printed.fingerprint,
  };
}

/** @deprecated Use buildVocabularySeedManifest. */
export const buildVocabularyRebuildManifest = buildVocabularySeedManifest;

export function assertVocabularySeedMatches(
  expected: VocabularySeedManifest,
  observed: Pick<
    VocabularySeedManifest,
    | "algorithmVersion"
    | "sourceEntries"
    | "lexemes"
    | "relations"
    | "tags"
    | "fingerprint"
  >,
): void {
  if (
    expected.algorithmVersion !== observed.algorithmVersion ||
    expected.sourceEntries !== observed.sourceEntries ||
    expected.lexemes !== observed.lexemes ||
    expected.relations !== observed.relations ||
    expected.tags !== observed.tags ||
    expected.fingerprint !== observed.fingerprint
  ) {
    throw new Error("Vocabulary seed fingerprint mismatch");
  }
}

/** @deprecated Use assertVocabularySeedMatches. */
export const assertVocabularyRebuildMatches = assertVocabularySeedMatches;
