import { readFileSync } from "node:fs";
import {
  CURATED_PLACEMENT_VERSION,
  cloneCuratedOverride,
  serializeCuratedWordPlacementFile,
  type CuratedPlacementOverride,
  type CuratedWordPlacementFile,
} from "@/domain/vocabulary/curated-placement";
import { curatedPlacementIssues } from "@/domain/vocabulary/validate-curated-placement";
import type { PlacementBandDefinition } from "@/domain/vocabulary/provisional-placement";
import type { CuratedPlacementStore } from "./curated-placement-store";
import { curatedPlacementFilePath } from "./curated-placement-store";
import type { VocabularyDataset } from "./load-vocabulary-dataset";

export interface CuratedPlacementImportPlan {
  filePath: string;
  recordCount: number;
  valid: boolean;
  issues: ReturnType<typeof curatedPlacementIssues>;
}

export function readCuratedWordPlacementFile(
  filePath = curatedPlacementFilePath(),
): CuratedWordPlacementFile {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as CuratedWordPlacementFile;
  return {
    version: parsed.version ?? CURATED_PLACEMENT_VERSION,
    records: Array.isArray(parsed.records)
      ? parsed.records.map(cloneCuratedOverride)
      : [],
  };
}

export function planCuratedPlacementImport(args: {
  dataset: VocabularyDataset;
  definition: PlacementBandDefinition;
  filePath?: string;
}): CuratedPlacementImportPlan {
  const filePath = args.filePath ?? curatedPlacementFilePath();
  const file = readCuratedWordPlacementFile(filePath);
  const issues = curatedPlacementIssues({
    definition: args.definition,
    records: file.records,
    lexemeIds: new Set(args.dataset.lexemes.map((lexeme) => lexeme.id)),
    canonicalKeys: new Set(args.dataset.lexemes.map((lexeme) => lexeme.canonicalKey)),
  });
  return {
    filePath,
    recordCount: file.records.length,
    valid: issues.length === 0,
    issues,
  };
}

export async function applyCuratedPlacementImport(args: {
  store: CuratedPlacementStore;
  records: readonly CuratedPlacementOverride[];
}): Promise<{ upserted: number }> {
  for (const record of args.records) {
    await args.store.upsert(cloneCuratedOverride(record));
  }
  return { upserted: args.records.length };
}

export function serializeCuratedPlacementExport(
  records: readonly CuratedPlacementOverride[],
): string {
  const sorted = [...records]
    .map(cloneCuratedOverride)
    .sort((left, right) => left.lexemeId.localeCompare(right.lexemeId));
  return serializeCuratedWordPlacementFile({
    version: CURATED_PLACEMENT_VERSION,
    records: sorted,
  });
}
