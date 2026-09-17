import { readFileSync } from "node:fs";
import path from "node:path";
import { summarizeProvisionalPlacement } from "@/domain/vocabulary/generate-provisional-placement";
import type {
  PlacementBandDefinition,
  ProvisionalLexemePlacement,
  ProvisionalPlacementQaReport,
  ProvisionalWordPlacementFile,
} from "@/domain/vocabulary/provisional-placement";
import { provisionalPlacementIssues } from "@/domain/vocabulary/validate-provisional-placement";
import type { VocabularyPlacementProvider } from "@/domain/vocabulary/vocabulary-placement-provider";
import {
  defaultVocabularyDataRoot,
  type VocabularyDataset,
} from "./load-vocabulary-dataset";

export function provisionalPlacementDataRoot(
  cwd = process.cwd(),
): string {
  return path.join(defaultVocabularyDataRoot(cwd), "placement");
}

export function readProvisionalBandDefinition(
  dataRoot = defaultVocabularyDataRoot(),
): PlacementBandDefinition {
  return JSON.parse(
    readFileSync(
      path.join(dataRoot, "placement", "provisional-band-definition.json"),
      "utf8",
    ),
  ) as PlacementBandDefinition;
}

export function readProvisionalWordPlacementFile(
  dataRoot = defaultVocabularyDataRoot(),
): ProvisionalWordPlacementFile {
  return JSON.parse(
    readFileSync(
      path.join(dataRoot, "placement", "provisional-word-placement.json"),
      "utf8",
    ),
  ) as ProvisionalWordPlacementFile;
}

export class FileVocabularyPlacementProvider
  implements VocabularyPlacementProvider
{
  private readonly definition: PlacementBandDefinition;
  private readonly placements: ProvisionalLexemePlacement[];
  private readonly qa: ProvisionalPlacementQaReport;

  constructor(
    dataset: VocabularyDataset,
    definition = readProvisionalBandDefinition(),
    file = readProvisionalWordPlacementFile(),
  ) {
    const byCanonical = new Map(
      dataset.lexemes.map((lexeme) => [lexeme.canonicalKey, lexeme]),
    );
    const byId = new Map(dataset.lexemes.map((lexeme) => [lexeme.id, lexeme]));
    const mapped: ProvisionalLexemePlacement[] = file.records.map((record) => {
      const lexeme =
        byCanonical.get(record.lexemeId) ?? byId.get(record.lexemeId);
      return {
        lexemeId: lexeme?.id ?? record.lexemeId,
        provisionalBand: {
          ...record.provisionalBand,
          provenance: [...record.provisionalBand.provenance],
        },
      };
    });
    const canonicalKeys = new Set(
      dataset.lexemes.map((lexeme) => lexeme.canonicalKey),
    );
    const fileIssues = provisionalPlacementIssues({
      definition,
      records: file.records,
      canonicalKeys,
    });
    if (fileIssues.length > 0) {
      throw new Error(
        `Bundled provisional placement is invalid:\n${fileIssues
          .map((issue) => `${issue.code}: ${issue.message}`)
          .join("\n")}`,
      );
    }
    this.definition = {
      version: definition.version,
      bands: definition.bands.map((band) => ({
        id: band.id,
        order: band.order,
      })),
    };
    this.placements = mapped.sort((left, right) =>
      left.lexemeId.localeCompare(right.lexemeId),
    );
    this.qa = summarizeProvisionalPlacement(
      definition,
      file.records,
      canonicalKeys,
    );
  }

  async getBandDefinition(): Promise<PlacementBandDefinition> {
    return {
      version: this.definition.version,
      bands: this.definition.bands.map((band) => ({ ...band })),
    };
  }

  async listProvisionalPlacements(): Promise<ProvisionalLexemePlacement[]> {
    return this.placements.map((record) => ({
      lexemeId: record.lexemeId,
      provisionalBand: {
        ...record.provisionalBand,
        provenance: [...record.provisionalBand.provenance],
      },
    }));
  }

  async summarizeProvisionalPlacement(): Promise<ProvisionalPlacementQaReport> {
    return {
      ...this.qa,
      bandCounts: { ...this.qa.bandCounts },
      duplicateLexemeIds: [...this.qa.duplicateLexemeIds],
      missingLexemeIds: [...this.qa.missingLexemeIds],
      unknownLexemeIds: [...this.qa.unknownLexemeIds],
    };
  }
}

/** Server/domain read API for the future Step C review page. Not a student route. */
export function bundledProvisionalPlacementProvider(
  dataset: VocabularyDataset,
): FileVocabularyPlacementProvider {
  return new FileVocabularyPlacementProvider(dataset);
}
