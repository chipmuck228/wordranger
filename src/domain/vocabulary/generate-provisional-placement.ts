import {
  compareProvisionalLexemeIdentity,
  orderedPlacementBands,
  PROVISIONAL_BAND_STRATEGY_ID,
  PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
  type LexemeProvisionalIdentity,
  type PlacementBandDefinition,
  type ProvisionalLexemePlacement,
  type ProvisionalPlacementQaReport,
  type ProvisionalWordPlacementFile,
} from "./provisional-placement";
import { provisionalPlacementIssues } from "./validate-provisional-placement";

export function generateProvisionalAssignments(
  definition: PlacementBandDefinition,
  lexemes: readonly LexemeProvisionalIdentity[],
): ProvisionalLexemePlacement[] {
  const bands = orderedPlacementBands(definition);
  if (bands.length === 0) {
    throw new Error("Provisional band definition has no bands");
  }
  const sorted = [...lexemes].sort(compareProvisionalLexemeIdentity);
  return sorted
    .map((lexeme, index) => {
      const band = bands[index % bands.length];
      const record: ProvisionalLexemePlacement = {
        lexemeId: lexeme.canonicalKey,
        provisionalBand: {
          value: band.id,
          source: "INFERRED",
          provenance: [
            PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
            PROVISIONAL_BAND_STRATEGY_ID,
          ],
        },
      };
      return record;
    })
    .sort((left, right) => left.lexemeId.localeCompare(right.lexemeId));
}

export function summarizeProvisionalPlacement(
  definition: PlacementBandDefinition,
  records: readonly ProvisionalLexemePlacement[],
  canonicalKeys: ReadonlySet<string>,
  generatorVersion = PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
): ProvisionalPlacementQaReport {
  const seen = new Map<string, number>();
  const unknownLexemeIds: string[] = [];
  const bandCounts: Record<string, number> = {};
  for (const band of orderedPlacementBands(definition)) {
    bandCounts[band.id] = 0;
  }

  for (const record of records) {
    seen.set(record.lexemeId, (seen.get(record.lexemeId) ?? 0) + 1);
    if (!canonicalKeys.has(record.lexemeId)) {
      unknownLexemeIds.push(record.lexemeId);
      continue;
    }
    const bandId = record.provisionalBand.value;
    bandCounts[bandId] = (bandCounts[bandId] ?? 0) + 1;
  }

  const duplicateLexemeIds = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([lexemeId]) => lexemeId)
    .sort();
  const assigned = new Set(
    [...seen.keys()].filter((lexemeId) => canonicalKeys.has(lexemeId)),
  );
  const missingLexemeIds = [...canonicalKeys]
    .filter((lexemeId) => !assigned.has(lexemeId))
    .sort();
  const uniqueUnknown = [...new Set(unknownLexemeIds)].sort();

  return {
    totalCanonicalLexemes: canonicalKeys.size,
    assignedLexemes: assigned.size,
    coverage:
      canonicalKeys.size === 0 ? 0 : assigned.size / canonicalKeys.size,
    bandCounts,
    duplicateLexemeIds,
    missingLexemeIds,
    unknownLexemeIds: uniqueUnknown,
    generatorVersion,
  };
}

export function buildProvisionalWordPlacementFile(
  definition: PlacementBandDefinition,
  lexemes: readonly LexemeProvisionalIdentity[],
): ProvisionalWordPlacementFile {
  const records = generateProvisionalAssignments(definition, lexemes);
  const canonicalKeys = new Set(lexemes.map((lexeme) => lexeme.canonicalKey));
  const qa = summarizeProvisionalPlacement(
    definition,
    records,
    canonicalKeys,
  );
  const issues = provisionalPlacementIssues({
    definition,
    records,
    canonicalKeys,
  });
  if (issues.length > 0 || qa.coverage !== 1) {
    throw new Error(
      `Provisional placement generation is incomplete:\n${issues
        .map((issue) => `${issue.code}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  return {
    meta: {
      version: definition.version,
      generatorVersion: PROVISIONAL_PLACEMENT_GENERATOR_VERSION,
      strategy: PROVISIONAL_BAND_STRATEGY_ID,
      authoritative: false,
      qa,
    },
    records,
  };
}

export function serializeProvisionalWordPlacementFile(
  file: ProvisionalWordPlacementFile,
): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
