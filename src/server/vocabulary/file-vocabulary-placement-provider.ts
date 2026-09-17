import { readFileSync } from "node:fs";
import path from "node:path";
import {
  mergeEffectivePlacements,
  summarizePlacementReview,
} from "@/domain/vocabulary/effective-placement";
import type { CuratedPlacementOverride } from "@/domain/vocabulary/curated-placement";
import type { EffectivePlacement } from "@/domain/vocabulary/curated-placement";
import type { PlacementReviewCoverage } from "@/domain/vocabulary/curated-placement";
import { summarizeProvisionalPlacement } from "@/domain/vocabulary/generate-provisional-placement";
import type {
  PlacementBandDefinition,
  ProvisionalLexemePlacement,
  ProvisionalPlacementQaReport,
  ProvisionalWordPlacementFile,
} from "@/domain/vocabulary/provisional-placement";
import { provisionalPlacementIssues } from "@/domain/vocabulary/validate-provisional-placement";
import type { VocabularyPlacementProvider } from "@/domain/vocabulary/vocabulary-placement-provider";
import type { CuratedPlacementStore } from "./curated-placement-store";
import { FileCuratedPlacementStore } from "./curated-placement-store";
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
  private readonly lexemeIds: Set<string>;

  constructor(
    private readonly dataset: VocabularyDataset,
    definition = readProvisionalBandDefinition(),
    file = readProvisionalWordPlacementFile(),
    private readonly curatedStore: CuratedPlacementStore = new FileCuratedPlacementStore(),
  ) {
    this.lexemeIds = new Set(dataset.lexemes.map((lexeme) => lexeme.id));
    const canonicalKeys = new Set(
      dataset.lexemes.map((lexeme) => lexeme.canonicalKey),
    );
    const fileIssues = provisionalPlacementIssues({
      definition,
      records: file.records,
      lexemeIds: this.lexemeIds,
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
    this.placements = file.records
      .map((record) => ({
        lexemeId: record.lexemeId,
        provisionalBand: {
          ...record.provisionalBand,
          provenance: [...record.provisionalBand.provenance],
        },
      }))
      .sort((left, right) => left.lexemeId.localeCompare(right.lexemeId));
    this.qa = summarizeProvisionalPlacement(
      definition,
      file.records,
      this.lexemeIds,
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

  async listCuratedOverrides(): Promise<CuratedPlacementOverride[]> {
    return this.curatedStore.list();
  }

  async listEffectivePlacements(): Promise<EffectivePlacement[]> {
    const [provisional, curated] = await Promise.all([
      this.listProvisionalPlacements(),
      this.listCuratedOverrides(),
    ]);
    return mergeEffectivePlacements(provisional, curated);
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

  async summarizePlacementReview(): Promise<PlacementReviewCoverage> {
    const curated = await this.listCuratedOverrides();
    return summarizePlacementReview({
      definition: this.definition,
      totalLexemes: this.dataset.lexemes.length,
      provisionalCount: this.placements.length,
      curated,
      lexemeIds: this.lexemeIds,
    });
  }
}

export function bundledVocabularyPlacementProvider(
  dataset: VocabularyDataset,
  curatedStore?: CuratedPlacementStore,
): FileVocabularyPlacementProvider {
  return new FileVocabularyPlacementProvider(
    dataset,
    undefined,
    undefined,
    curatedStore,
  );
}

/** Server/domain read API for the review page. Not a student route. */
export function bundledProvisionalPlacementProvider(
  dataset: VocabularyDataset,
): FileVocabularyPlacementProvider {
  return bundledVocabularyPlacementProvider(dataset);
}
